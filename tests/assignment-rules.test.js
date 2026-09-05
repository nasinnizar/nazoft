import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAssignmentRules } from '../src/services/assignment-rules.js';
const members=[{email:'nasin@example.com',name:'Nasin'},{email:'manager@example.com',name:'Manager'}];
const rules=[{keyword:'Nasin',ownerEmail:members[0].email},{keyword:'Riyadh',ownerEmail:members[1].email}];
test('campaign rules ignore case and choose the first match',()=>{
  const state={assignmentRules:rules,leads:[{leadNumber:'1',source:'Meta Ad',campaign_name:'RIYADH - NASIN offer'}]};
  applyAssignmentRules(state,{},members,123);
  assert.equal(state.leads[0].owner,'Nasin');
  assert.equal(state.leads[0].timeline[0].at,123);
});
test('existing leads and non-Meta leads keep their owners',()=>{
  const lead={leadNumber:'1',source:'Meta Ad',campaignName:'nasin',owner:'Original'};
  const state={assignmentRules:rules,leads:[lead,{...lead,leadNumber:'2',source:'Manual'}]};
  applyAssignmentRules(state,{leads:[{leadNumber:'1'}]},members);
  assert.equal(state.leads[0].owner,'Original');
  assert.equal(state.leads[1].owner,'Original');
});
test('missing campaigns or inactive recipients leave normal assignment intact',()=>{
  const state={assignmentRules:rules,leads:[{leadNumber:'1',source:'Meta Ad',campaign:'Nasin',owner:'Original'},{leadNumber:'2',source:'Meta Ad',owner:'Original'}]};
  applyAssignmentRules(state,{},[]);
  assert.ok(state.leads.every(lead=>lead.owner==='Original'));
});
