import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../scripts/proposal-pdf.js';
const {totals,defaults}=globalThis.CrmProposalPdf;
test('proposal workflow assigns numbers on save or send and requires confirmation for stage change',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(!html.includes("if(stageName==='Proposal sent')ensureProposalNumber"));
  const script=await readFile(new URL('../scripts/proposals.js',import.meta.url),'utf8');
  assert.doesNotMatch(script,/>Generate proposal number</);assert.match(script,/proposalNumberPreview/);assert.match(script,/ensureReference/);assert.match(script,/Confirm sent/);assert.match(script,/pendingDelivery.snapshot/);assert.match(script,/name="note"/);
  assert.match(script,/data-proposal-status="draft"/);assert.match(script,/data-proposal-status="saved"/);assert.match(script,/data-proposal-status="sent"/);
  assert.match(script,/data-save-draft/);assert.match(script,/>Save</);assert.match(script,/uiIcon\(channel==='WhatsApp'\?'whatsapp':'mail'\)/);
  assert.match(script,/\['reference','Proposal reference preview'\]/);assert.match(script,/\['date','Date','date'\]/);
  assert.match(html,/input\.closest\('dialog\[open\]'\)\|\|document\.body/);
});
test('proposal totals match the template and compute VAT after discount',()=>{
  assert.deepEqual(totals({items:defaults,discount:5000,vat:0}),{subtotal:56000,discount:5000,tax:0,total:51000});
  assert.equal(totals({items:[{description:'Service',quantity:2,price:100}],discount:20,vat:15}).total,207);
});
test('proposal validation rejects negative prices and excessive discounts',()=>{
  assert.throws(()=>totals({items:[{description:'Service',quantity:1,price:-1}],discount:0,vat:0}));
  assert.throws(()=>totals({items:defaults,discount:999999,vat:0}));
  assert.throws(()=>totals({items:[],discount:0,vat:0}));
});
