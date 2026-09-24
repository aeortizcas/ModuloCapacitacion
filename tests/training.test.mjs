import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.NODE_ENV='test';
const directory=mkdtempSync(join(tmpdir(),'innovacampus-test-'));
process.env.DB_PATH=join(directory,'test.db');
let base=process.env.TEST_API_URL;
if(!base){
  const {server}=await import('../server.mjs');
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  base='http://127.0.0.1:'+server.address().port;
  after(()=>new Promise(r=>server.close(r)));
}
async function call(path,{method='GET',data,cookie,origin}={}){if(path==='/setup'&&data&&process.env.TEST_SETUP_TOKEN)data={...data,setupToken:process.env.TEST_SETUP_TOKEN};const res=await fetch(base+'/api'+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
let trainer,learner,course;
test('complete training journey with server authorization and grading',async()=>{
assert.equal((await call('/courses')).status,401);
assert.equal((await call('/session')).body.needsSetup,true);
const setup=await call('/setup',{method:'POST',data:{name:'Capacitador',email:'trainer@example.com',password:'training-secure-123'}});assert.equal(setup.status,200);trainer=setup.cookie;assert.equal(setup.body.user.role,'trainer');
assert.equal((await call('/setup',{method:'POST',data:{name:'Intruso',email:'other@example.com',password:'training-secure-123'}})).status,403);
assert.equal((await call('/login',{method:'POST',data:{email:'trainer@example.com',password:'incorrecta'}})).status,401);
const reg=await call('/register',{method:'POST',data:{name:'Participante',email:'learner@example.com',password:'learning-secure-123',role:'trainer'}});assert.equal(reg.status,200);learner=reg.cookie;assert.equal(reg.body.user.role,'learner');
assert.equal((await call('/team',{cookie:learner})).status,403);
assert.equal((await call('/dashboard',{cookie:learner})).status,403);
assert.equal((await call('/login',{method:'POST',data:{email:'learner@example.com',password:'learning-secure-123',portal:'trainer'}})).status,403);
assert.equal((await call('/login',{method:'POST',data:{email:'trainer@example.com',password:'training-secure-123',portal:'learner'}})).status,403);
assert.equal((await call('/login',{method:'POST',data:{email:'learner@example.com',password:'learning-secure-123',portal:'learner'}})).status,200);
const initialDashboard=(await call('/dashboard',{cookie:trainer})).body;
assert.equal(initialDashboard.stats.learners,1);assert.equal(initialDashboard.stats.published,3);assert.equal(initialDashboard.stats.pending,3);
assert.equal(initialDashboard.learners[0].courses.every(c=>c.status==='pending'),true);
const payload={title:'Escucha activa',category:'Habilidades',description:'Práctica real',minutes:20,content:'Escucha y confirma.',video:'https://youtu.be/abcdefghijk',published:false,pass:80,questions:[{text:'¿Qué haces primero?',options:['Escuchar','Interrumpir'],correct:0}]};
assert.equal((await call('/courses',{method:'POST',cookie:learner,data:payload})).status,403);
const created=await call('/courses',{method:'POST',cookie:trainer,data:payload});assert.equal(created.status,200);course=created.body.id;
for(const video of ['https://www.youtube.com/watch?v=abcdefghijk&list=example','https://youtu.be/abcdefghijk?si=example','https://www.youtube.com/shorts/abcdefghijk','https://www.youtube.com/live/abcdefghijk','https://www.youtube.com/embed/abcdefghijk','https://m.youtube.com/watch?v=abcdefghijk']){
  assert.equal((await call('/courses/'+course,{method:'PUT',cookie:trainer,data:{...payload,video}})).status,200,video);
  const saved=(await call('/courses',{cookie:trainer})).body.courses.find(c=>c.id===course);
  assert.equal(saved.video,'abcdefghijk');
}
for(const video of ['javascript:alert(1)','http://www.youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.example/watch?v=abcdefghijk','https://www.youtube.com/watch?v=short']){
  assert.equal((await call('/courses/'+course,{method:'PUT',cookie:trainer,data:{...payload,video}})).status,400,video);
}
assert.equal((await call('/courses',{cookie:learner})).body.courses.some(c=>c.id===course),false);
assert.equal((await call('/courses/'+course,{method:'PUT',cookie:trainer,data:{...payload,video:'https://evil.example.com/watch?v=abcdefghijk'}})).status,400);
assert.equal((await call('/courses/'+course,{method:'PUT',cookie:trainer,origin:'https://evil.example.com',data:payload})).status,403);
assert.equal((await call('/courses/'+course,{method:'PUT',cookie:trainer,data:{...payload,published:true}})).status,200);
const published=(await call('/courses',{cookie:learner})).body.courses.find(c=>c.id===course);assert.equal(published.video,'abcdefghijk');assert.equal('correct' in published.questions[0],false);
assert.equal((await call(`/courses/${course}/progress`,{method:'POST',cookie:learner,data:{notes:'Nota privada',completed:true}})).status,200);
assert.equal((await call('/courses',{cookie:trainer})).body.courses.find(c=>c.id===course).progress.notes,'');
assert.equal((await call(`/courses/${course}/attempt`,{method:'POST',cookie:learner,data:{answers:[],revision:1}})).status,400);
assert.equal((await call(`/courses/${course}/attempt`,{method:'POST',cookie:trainer,data:{answers:[0],revision:1}})).status,403);
assert.equal((await call(`/courses/${course}/progress`,{method:'POST',cookie:trainer,data:{completed:true}})).status,403);
const ready=(await call('/dashboard',{cookie:trainer})).body;
assert.equal(ready.learners[0].courses.find(c=>c.id===course).status,'ready');
assert.equal(JSON.stringify(ready).includes('Nota privada'),false);
const failed=await call(`/courses/${course}/attempt`,{method:'POST',cookie:learner,data:{answers:[1],revision:1,score:100}});assert.equal(failed.body.score,0);assert.equal(failed.body.passed,false);
const retry=(await call('/dashboard',{cookie:trainer})).body;
assert.equal(retry.stats.retry,1);assert.equal(retry.learners[0].courses.find(c=>c.id===course).status,'retry');
const success=await call(`/courses/${course}/attempt`,{method:'POST',cookie:learner,data:{answers:[0],revision:1}});assert.equal(success.body.score,100);assert.equal(success.body.passed,true);
const passedDashboard=(await call('/dashboard',{cookie:trainer})).body;
assert.equal(passedDashboard.stats.passed,1);assert.equal(passedDashboard.learners[0].courses.find(c=>c.id===course).status,'passed');
const report=(await call('/team',{cookie:trainer})).body;assert.equal(report.results.length,2);assert.equal(report.results[0].name,'Participante');
assert.equal((await call('/courses/'+course,{method:'PUT',cookie:trainer,data:{...payload,published:true,questions:[{text:'Pregunta nueva',options:['A','B'],correct:1}]}})).status,200);
assert.equal((await call(`/courses/${course}/attempt`,{method:'POST',cookie:learner,data:{answers:[0],revision:1}})).status,409);
const revisedDashboard=(await call('/dashboard',{cookie:trainer})).body;
assert.equal(revisedDashboard.stats.passed,0);assert.equal(revisedDashboard.learners[0].courses.find(c=>c.id===course).score,null);
const login=await call('/login',{method:'POST',data:{email:'learner@example.com',password:'learning-secure-123'}});assert.equal(login.status,200);assert.equal((await call('/courses',{cookie:login.cookie})).body.courses.find(c=>c.id===course).progress.notes,'Nota privada');
const learner2=await call('/register',{method:'POST',data:{name:'Otra persona',email:'second@example.com',password:'learning-secure-456'}});
await call('/team/'+learner2.body.user.id,{method:'PUT',cookie:trainer,data:{role:'trainer'}});
assert.equal((await call('/courses',{cookie:learner2.cookie})).status,401);
learner2.cookie=(await call('/login',{method:'POST',data:{email:'second@example.com',password:'learning-secure-456'}})).cookie;
assert.equal((await call('/courses/'+course,{method:'PUT',cookie:learner2.cookie,data:payload})).status,404);
const otherDashboard=(await call('/dashboard',{cookie:learner2.cookie})).body;
assert.equal(otherDashboard.courses.length,0);assert.equal(otherDashboard.recent.length,0);assert.equal(otherDashboard.stats.learners,1);
assert.equal((await call('/logout',{method:'POST',cookie:learner,data:{}})).status,200);assert.equal((await call('/courses',{cookie:learner})).status,401);
const staticResponse=await fetch(base+'/');assert.equal(staticResponse.status,200);assert.ok(staticResponse.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.equal((await fetch(base+'/server.mjs')).status,404);
});
