import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV='test';
process.env.DB_PATH=join(mkdtempSync(join(tmpdir(),'campus-mvc-')),'test.db');
const {server}=await import('../server.mjs');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
after(()=>new Promise(resolve=>server.close(resolve)));
const base=`http://127.0.0.1:${server.address().port}`;

test('production serves the complete MVC module graph and keeps server files private', async()=>{
  const visited=new Set();
  async function visit(path) {
    if(visited.has(path))return;
    visited.add(path);
    const response=await fetch(base+path);
    assert.equal(response.status,200,path);
    assert.match(response.headers.get('content-type'),/javascript/,path);
    const source=await response.text();
    for(const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      await visit(new URL(match[1],base+path).pathname);
    }
  }
  await visit('/app.js');
  assert.equal(visited.size,6);
  for(const path of ['/','/index.html','/styles.css','/navigation.css'])assert.equal((await fetch(base+path)).status,200,path);
  for(const path of ['/src/models/database.mjs','/data/training.db','/package.json','/views/index.html'])assert.equal((await fetch(base+path)).status,404,path);
  const invalid=await fetch(base+'/api/session',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(invalid.status,405);
});

test('Pages includes every imported module with repository-relative paths',()=>{
  const visited=new Set();
  function visit(url) {
    if(visited.has(url.href))return;
    visited.add(url.href);
    const source=readFileSync(url,'utf8');
    for(const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'));
      visit(new URL(match[1],url));
    }
  }
  visit(new URL('../docs/app.js',import.meta.url));
  assert.equal(visited.size,7);
});

test('real client controller boots using an injected demo login and handles logout',async()=>{
  const {startCampus}=await import('../client/controllers/campus-controller.js');
  const {state}=await import('../client/models/campus-model.js');
  const events={}, calls=[];
  let logins=0;
  const previousDocument=globalThis.document;
  globalThis.document={addEventListener:(name,callback)=>{events[name]=callback;}};
  try {
    await startCampus({api:async(path)=>{calls.push(path);return {user:null,needsSetup:false};},authView:async()=>{logins++;}});
    assert.deepEqual(calls,['/session']);
    assert.equal(logins,1);
    assert.equal(state.authMode,'login');
    const button={dataset:{action:'logout'}};
    await events.click({target:{closest:()=>button},preventDefault(){}});
    assert.deepEqual(calls,['/session','/logout']);
    assert.equal(logins,2);
    assert.equal(state.user,null);
    assert.equal(button.disabled,false);
  } finally {globalThis.document=previousDocument;}
});
