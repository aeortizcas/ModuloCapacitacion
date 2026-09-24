import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { scryptSync } from 'node:crypto';

process.env.NODE_ENV='test';
process.env.DB_PATH=join(mkdtempSync(join(tmpdir(),'campus-access-')),'test.db');
const legacy=new DatabaseSync(process.env.DB_PATH);
legacy.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('trainer','learner')))");
const password='valid-password-123', salt='migration-test';
const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
for(const [id,role] of [[1,'trainer'],[2,'trainer'],[3,'learner']])legacy.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,'Original '+id,`original${id}@example.com`,hash,role);
legacy.close();
const {server}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
after(()=>new Promise(resolve=>server.close(resolve)));
const base='http://127.0.0.1:'+server.address().port;
async function call(path,method='GET',data,cookie){
  const res=await fetch(base+'/api'+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});
  return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
}
const login=email=>call('/login','POST',{email,password});

test('legacy migration, administrator creation and enforcement of access levels',async()=>{
  const admin=await login('original1@example.com'),trainer=await login('original2@example.com');
  assert.equal(admin.body.user.id,1);assert.equal(admin.body.user.accessLevel,'admin');
  assert.equal(trainer.body.user.accessLevel,'trainer');
  assert.equal(trainer.body.user.permissions.includes('users.manage'),false);
  const listing=await call('/team','GET',undefined,admin.cookie);
  assert.equal(listing.body.users.length,3);
  assert.equal(JSON.stringify(listing.body).includes(hash),false);
  const create=(accessLevel,email,permissions)=>({name:'Nueva persona',email,password,accessLevel,...(permissions?{permissions}:{})});
  assert.equal((await call('/team','POST',create('admin','blocked@example.com'),trainer.cookie)).status,403);
  assert.equal((await call('/team/3','PUT',{accessLevel:'admin'},trainer.cookie)).status,403);
  assert.equal((await call('/team','GET',undefined,trainer.cookie)).body.users.length,0);
  assert.equal((await call('/team/1','PUT',{accessLevel:'learner'},admin.cookie)).status,400);
  assert.equal((await call('/team/999','PUT',{accessLevel:'learner'},admin.cookie)).status,404);
  assert.equal((await call('/team','POST',create('superuser','invalid@example.com'),admin.cookie)).status,400);
  assert.equal((await call('/team','POST',create('trainer','invalid@example.com',['users.manage']),admin.cookie)).status,400);
  assert.equal((await call('/team','POST',create('trainer','invalid@example.com',['courses.publish']),admin.cookie)).status,400);
  assert.equal((await call('/team','POST',create('advisor','invalid@example.com',['reports.view']),admin.cookie)).status,400);
  const author=await call('/team','POST',create('trainer','author@example.com',['courses.manage']),admin.cookie);
  assert.equal(author.status,201);assert.equal('password' in author.body.user,false);
  assert.equal((await call('/team','POST',create('learner','author@example.com'),admin.cookie)).status,409);
  const authorSession=await login('author@example.com');
  assert.equal((await call('/dashboard','GET',undefined,authorSession.cookie)).status,403);
  assert.equal((await call('/team','GET',undefined,authorSession.cookie)).status,403);
  const course={title:'Curso',content:'Material',category:'General',description:'Ejemplo',minutes:10,pass:80,published:false,questions:[{text:'Pregunta',options:['A','B'],correct:0}]};
  const draft=await call('/courses','POST',course,authorSession.cookie);
  assert.equal(draft.status,200);
  assert.equal((await call('/courses/'+draft.body.id,'PUT',{...course,published:true},authorSession.cookie)).status,403);
  assert.equal((await call('/team/'+author.body.user.id,'PUT',{accessLevel:'trainer',permissions:['courses.manage','courses.publish','reports.view']},admin.cookie)).status,200);
  assert.equal((await call('/session','GET',undefined,authorSession.cookie)).body.user,null);
  const activeAuthor=await login('author@example.com');
  assert.equal((await call('/courses/'+draft.body.id,'PUT',{...course,published:true},activeAuthor.cookie)).status,200);
  for(const level of ['advisor','learner']){
    const created=await call('/team','POST',create(level,level+'@example.com'),admin.cookie);
    assert.equal(created.status,201);assert.equal(created.body.user.accessLevel,level);
    const session=await login(level+'@example.com');
    assert.equal((await call('/courses','POST',course,session.cookie)).status,403);
    assert.equal((await call('/team','GET',undefined,session.cookie)).status,403);
    const visible=await call('/courses','GET',undefined,session.cookie);
    assert.equal('correct' in visible.body.courses[0].questions[0],false);
    assert.equal((await call('/courses/'+draft.body.id+'/attempt','POST',{answers:[0],revision:1},session.cookie)).body.passed,true);
  }
  const secondAdmin=await call('/team','POST',create('admin','admin2@example.com'),admin.cookie);
  assert.equal(secondAdmin.body.user.permissions.includes('users.manage'),true);
  const noPermissions=await call('/team','POST',create('trainer','none@example.com',[]),admin.cookie);
  assert.equal(noPermissions.status,201);
  const limited=await login('none@example.com');
  assert.equal((await call('/courses','POST',course,limited.cookie)).status,403);
  // Public registration never trusts a requested privileged role or permission.
  const registered=await call('/register','POST',{...create('admin','public@example.com'),permissions:['users.manage']});
  assert.equal(registered.body.user.accessLevel,'learner');assert.deepEqual(registered.body.user.permissions,[]);
  // Existing progress and ownership survive a level change.
  const advisor=(await call('/team','GET',undefined,admin.cookie)).body.users.find(u=>u.accessLevel==='advisor');
  await call('/team/'+advisor.id,'PUT',{accessLevel:'learner'},admin.cookie);
  const advisorLogin=await login('advisor@example.com');
  assert.equal((await call('/courses','GET',undefined,advisorLogin.cookie)).body.courses[0].attempts.length,1);
});
