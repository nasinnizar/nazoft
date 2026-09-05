import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedPage } from '../src/middleware/protected-page.js';
function response(){return {headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},type(){return this;},send(value){this.body=value;return this;},redirect(n,url){this.code=n;this.location=url;}};}
test('unauthenticated page requests redirect without reading workspace',async()=>{
  const res=response();let read=false;
  await protectedPage({authenticate:async()=>null,workspace:async()=>{read=true;}})({},res,()=>assert.fail());
  assert.equal(res.code,303);assert.equal(res.location,'/login');assert.equal(read,false);assert.match(res.headers['Cache-Control'],/no-store/);
});
test('verified members can open protected pages',async()=>{
  const req={},res=response();let next=false;
  await protectedPage({authenticate:async()=>({id:'user'}),workspace:async id=>({id})})(req,res,()=>next=true);
  assert.equal(next,true);assert.equal(req.workspace.id,'user');
});
test('inactive membership and provider failures fail closed',async()=>{
  for(const statusCode of [403,500]){
    const res=response();await protectedPage({authenticate:async()=>({id:'user'}),workspace:async()=>{throw {statusCode};}})({},res,()=>assert.fail());
    assert.equal(res.code,statusCode===403?403:503);
  }
});
