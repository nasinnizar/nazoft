import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {encryptToken,decryptToken,validSignature} from '../src/services/meta-security.js';
test('Meta Page tokens are encrypted and bound to a tenant and Page',()=>{
  const key='a'.repeat(64),cipher=encryptToken('private-page-token',key,'org:page');
  assert.ok(!cipher.includes('private-page-token'));
  assert.equal(decryptToken(cipher,key,'org:page'),'private-page-token');
  assert.throws(()=>decryptToken(cipher,key,'other:page'));
  assert.throws(()=>decryptToken(cipher,'b'.repeat(64),'org:page'));
});
test('Meta webhooks require a valid raw-byte signature',()=>{
  const body=Buffer.from('{"entry":[]}'),secret='test-secret',signature='sha256='+createHmac('sha256',secret).update(body).digest('hex');
  assert.ok(validSignature(body,signature,secret));
  assert.equal(validSignature(Buffer.from('{}'),signature,secret),false);
  assert.equal(validSignature(body,'',secret),false);
});
test('Meta credentials remain outside browser workspace tables and OAuth is single-use',async()=>{
  const sql=await readFile(new URL('../migrations/004_meta_connections.sql',import.meta.url),'utf8');
  const service=await readFile(new URL('../src/services/meta.js',import.meta.url),'utf8');
  assert.match(sql,/revoke all .* from anon, authenticated/s);
  assert.match(service,/delete from public.meta_oauth_states where state_hash=\$1 and user_id=\$2 and organization_id=\$3 and expires_at>now\(\)/);
  assert.match(service,/on conflict do nothing returning lead_id/);
  assert.match(service,/for update/);
});
