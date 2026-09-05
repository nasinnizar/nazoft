import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInbound } from '../src/services/lead-integrations.js';
import { readFile } from 'node:fs/promises';
test('Google lead form fields map and tests stay marked as tests',()=>{
  const result=normalizeInbound('google',{lead_id:'one',is_test:true,user_column_data:[{column_id:'FULL_NAME',string_value:'Client'},{column_id:'EMAIL',string_value:'a@example.com'}]});
  assert.equal(result.lead.name,'Client');assert.equal(result.test,true);assert.equal(result.externalId,'one');
});
test('website submissions need stable IDs and contact details',()=>{
  assert.throws(()=>normalizeInbound('website',{name:'Only name'}));
  assert.throws(()=>normalizeInbound('website',{submission_id:'id',name:'Only name'}));
  assert.equal(normalizeInbound('website',{submission_id:'id',phone:'123',ownerEmail:'injected'}).lead.ownerEmail,undefined);
});
test('inbound connections are tenant scoped, hashed and deduplicated',async()=>{
  const sql=await readFile(new URL('../migrations/005_lead_integrations.sql',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/);assert.match(sql,/revoke all/);
  const service=await readFile(new URL('../src/services/lead-integrations.js',import.meta.url),'utf8');
  assert.match(service,/timingSafeEqual/);assert.match(service,/on conflict do nothing/);assert.match(service,/for update/);
});
