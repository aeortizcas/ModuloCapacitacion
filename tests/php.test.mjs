import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const php=process.env.PHP_BIN || (existsSync('C:/xampp/php/php.exe') ? 'C:/xampp/php/php.exe' : 'php');
const available=spawnSync(php,['-v']);
const options={skip:available.status!==0 ? 'PHP no está disponible; configura PHP_BIN.' : false};
const setupToken=randomBytes(32).toString('hex');

async function launch(t,{registration=false,database,phpArgs=[]}={}) {
  const directory=mkdtempSync(join(tmpdir(),'campus-php-'));
  const build=spawnSync(php,['scripts/build-php.php',directory],{encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  const probe=createServer(); await new Promise(r=>probe.listen(0,'127.0.0.1',r));
  const port=probe.address().port; await new Promise(r=>probe.close(r));
  const dbPath=database || join(directory,'storage','test.db');
  const child=spawn(php,[...phpArgs,'-d','display_errors=0','-d',`sys_temp_dir=${directory}`,'-S',`127.0.0.1:${port}`,'-t',join(directory,'public_html'),join(directory,'router.php')],{
    env:{...process.env,DB_PATH:dbPath,SETUP_TOKEN:setupToken,ALLOW_REGISTRATION:String(registration),APP_ORIGIN:''},stdio:['ignore','pipe','pipe'],windowsHide:true,
  });
  let logs=''; child.stderr.on('data',chunk=>logs+=chunk); child.stdout.on('data',chunk=>logs+=chunk);
  t.after(async()=>{if(child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;}});
  const base=`http://127.0.0.1:${port}`;
  let ready=false;
  for(let i=0;i<100;i++){
    try { const r=await fetch(base+'/index.php?route=/api/session'); if(r.status===200){ready=true;break;} } catch {}
    if(child.exitCode!==null)break;
    await new Promise(r=>setTimeout(r,30));
  }
  assert.ok(ready,logs);
  async function call(path,{method='GET',data,cookie,raw,origin}={}) {
    const r=await fetch(base+'/index.php?route=/api'+path,{method,headers:{...(method!=='GET'?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:raw??(data===undefined?undefined:JSON.stringify(data))});
    const text=await r.text();
    let body;try{body=JSON.parse(text);}catch{throw Error(path+': '+text+'\n'+logs);}
    return {status:r.status,body,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  return {call,base,dbPath,directory,logs:()=>logs};
}

test('PHP passes the same complete training journey as Node',options,async t=>{
  const app=await launch(t,{registration:true});
  const child=spawn(process.execPath,['--test','tests/training.test.mjs'],{env:{...process.env,TEST_API_URL:app.base,TEST_SETUP_TOKEN:setupToken},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let result='';child.stdout.on('data',c=>result+=c);child.stderr.on('data',c=>result+=c);
  const code=await new Promise(r=>child.once('exit',r));
  assert.equal(code,0,result+'\n'+app.logs());
});

test('PHP protects setup, private files, roles and malformed requests; serves the query-string API',options,async t=>{
  const {call,base}=await launch(t);
  const credentials={name:'Admin',email:'admin@example.test',password:'valid-password-123'};
  assert.equal((await call('/session')).body.allowRegistration,false);
  assert.equal((await call('/setup',{method:'POST',data:credentials})).status,403);
  const admin=await call('/setup',{method:'POST',data:{...credentials,setupToken}});
  assert.equal(admin.status,200);
  assert.equal((await call('/setup',{method:'POST',data:{...credentials,setupToken}})).status,403);
  assert.equal((await call('/register',{method:'POST',data:{...credentials,email:'outside@example.test'}})).status,403);
  assert.equal((await call('/login',{method:'POST',data:{email:"' OR 1=1 --",password:credentials.password}})).status,401);
  for(const path of ['/bootstrap.php','/config.local.php','/storage/test.db','/app/Models/schema.sql','/.htaccess','/bin/password.php'])assert.equal((await fetch(base+path)).status,404,path);
  for(const raw of ['null','[]','{"questions":', '"hello"']) assert.equal((await call('/courses',{method:'POST',cookie:admin.cookie,raw})).status,400);
  assert.equal((await call('/courses',{method:'POST',cookie:admin.cookie,raw:JSON.stringify({value:'x'.repeat(300001)})})).status,413);
  assert.equal((await call('/team',{method:'POST',cookie:admin.cookie,data:{},origin:'https://other.example'})).status,403);
  const author=await call('/team',{method:'POST',cookie:admin.cookie,data:{name:'Author',email:'author@example.test',password:credentials.password,accessLevel:'trainer',permissions:['courses.manage']}});
  assert.equal(author.status,201);
  let auth=(await call('/login',{method:'POST',data:{email:'author@example.test',password:credentials.password}})).cookie;
  const payload={title:'Draft',content:'Training',minutes:2,pass:80,questions:[{text:'Question',options:['A','B'],correct:0}],published:true};
  assert.equal((await call('/courses',{method:'POST',cookie:auth,data:payload})).status,403);
  assert.equal((await call('/courses',{method:'POST',cookie:auth,data:{...payload,published:false}})).status,200);
  assert.equal((await call('/team/'+author.body.user.id,{method:'PUT',cookie:admin.cookie,data:{accessLevel:'learner'}})).status,200);
  assert.equal((await call('/courses',{method:'POST',cookie:auth,data:payload})).status,401);
  auth=(await call('/login',{method:'POST',data:{email:'author@example.test',password:credentials.password}})).cookie;
  assert.equal((await call('/courses',{method:'POST',cookie:auth,data:payload})).status,403);
  // One user's bad attempts must not lock out every account on a shared IP.
  for(let i=0;i<31;i++)await call('/login',{method:'POST',data:{email:'missing@example.test',password:'incorrect'}});
  assert.equal((await call('/login',{method:'POST',data:credentials})).status,200);
  const visited=new Set();
  async function visit(path){if(visited.has(path))return;visited.add(path);const r=await fetch(base+path);assert.equal(r.status,200,path);const source=await r.text();for(const m of source.matchAll(/from ['"]([^'"]+)['"]/g))await visit(new URL(m[1],base+path).pathname);}
  await visit('/app.js');assert.equal(visited.size,6);
  const appSource=await (await fetch(base+'/app.js')).text();assert.match(appSource,/\.\/index\.php\?route=\/api/);
});

test('PHP migrates existing SQLite records without dropping history and resets credentials privately',options,async t=>{
  const directory=mkdtempSync(join(tmpdir(),'campus-legacy-'));const database=join(directory,'legacy.db');
  const legacy=new DatabaseSync(database);
  legacy.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('trainer','learner')))");
  const password='legacy-password-123',salt=randomBytes(16).toString('hex');
  const stored=salt+':'+scryptSync(password,salt,64).toString('hex');
  legacy.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(17,'Existing trainer','legacy@example.test',stored,'trainer');
  legacy.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(18,'Existing learner','learner@example.test',stored,'learner');
  legacy.exec(readFileSync('php/app/Models/schema.sql','utf8'));
  legacy.exec("INSERT INTO courses(id,owner,title,category,description,minutes,content,video,published) VALUES(31,17,'Existing course','Test','Description',10,'Material','',1); INSERT INTO progress VALUES(18,31,1,'Private notes'); INSERT INTO attempts(id,user_id,course_id,score,passed,answers,revision) VALUES(41,18,31,100,1,'[0]',1);");
  legacy.close();
  const app=await launch(t,{database});
  assert.equal((await app.call('/session')).body.needsSetup,false);
  const reset=spawnSync(php,[join(app.directory,'bin/password.php'),'legacy@example.test'],{env:{...process.env,DB_PATH:database},input:'new-password-123\n',encoding:'utf8'});
  assert.equal(reset.status,0,reset.stderr);
  const login=await app.call('/login',{method:'POST',data:{email:'legacy@example.test',password:'new-password-123'}});
  assert.equal(login.status,200);assert.equal(login.body.user.id,17);assert.equal(login.body.user.accessLevel,'admin');
  const report=await app.call('/dashboard',{cookie:login.cookie});
  assert.equal(report.body.courses[0].id,31);assert.equal(report.body.stats.passed,1);
  const check=new DatabaseSync(database);assert.equal(check.prepare('SELECT notes FROM progress WHERE user_id=18').get().notes,'Private notes');check.close();
});

test('Sodium compatibility matches Node scrypt and migrates hashes on successful login',options,async t=>{
  const salt=randomBytes(16).toString('hex'),password='legacy-ñ-password-123';
  const stored=salt+':'+scryptSync(password,salt,64).toString('hex');
  const source=`require 'php/bootstrap.php'; if(!function_exists('sodium_crypto_pwhash_scryptsalsa208sha256')){exit(77);} $d=json_decode(stream_get_contents(STDIN),true); echo Campus\\Models\\Passwords::verify($d['password'],$d['stored']) ? 'match' : 'mismatch';`;
  const result=spawnSync(php,['-d','extension=sodium','-r',source],{input:JSON.stringify({password,stored}),encoding:'utf8'});
  if(result.status===77){t.skip('Sodium no está disponible; la migración requiere restablecer contraseñas.');return;}
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'match');
  const dir=mkdtempSync(join(tmpdir(),'campus-scrypt-')),database=join(dir,'test.db');
  const db=new DatabaseSync(database);db.exec(readFileSync('php/app/Models/schema.sql','utf8'));
  db.prepare('INSERT INTO users(id,name,email,password,role) VALUES(1,?,?,?,?)').run('Legacy','legacy@example.test',stored,'trainer');db.close();
  const app=await launch(t,{database,phpArgs:['-d','extension=sodium']});
  assert.equal((await app.call('/login',{method:'POST',data:{email:'legacy@example.test',password}})).status,200);
  const check=new DatabaseSync(database);assert.match(check.prepare('SELECT password FROM users WHERE id=1').get().password,/^php-sha256:/);check.close();
});
