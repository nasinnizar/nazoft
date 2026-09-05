import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/task-helpers.js';
const {parseTitle,automaticTasks,activityRows}=globalThis.CrmTaskHelpers;
test('task titles detect today, next Sunday, noon and exact minutes',()=>{
  const now=new Date(2026,8,5,16,0);
  assert.equal(parseTitle('client meeting at 12pm',now).dueAt,'2026-09-05T12:00');
  assert.equal(parseTitle('remind me on sunday at 12',now).dueAt,'2026-09-06T12:00');
  assert.equal(parseTitle('call tomorrow at 9:17am',now).dueAt,'2026-09-06T09:17');
  assert.equal(parseTitle('call at 25:00',now).dueAt,undefined);
});
test('automatic tasks are stable, assigned-only and track schedule changes',()=>{
 const lead={leadNumber:'1',ownerEmail:'me',name:'Test',status:'Uncontacted',createdAt:'2026-09-05T10:00',followAt:'2026-09-06T12:17'};
 const first=automaticTasks([lead],'me');assert.equal(first.length,2);assert.equal(automaticTasks([lead],'other').length,0);
 assert.equal(first[0].id,automaticTasks([lead],'me')[0].id);
 assert.notEqual(first[0].id,automaticTasks([{...lead,followAt:'2026-09-07T12:17'}],'me')[0].id);
 assert.equal(automaticTasks([{...lead,status:'Won'}],'me').length,0);
});
test('activity summary does not count scheduled meetings as completed',()=>{
 const rows=activityRows([{createdAt:'2026-09-05',timeline:[{title:'Meeting scheduled',at:'2026-09-05'},{title:'Meeting completed',at:'2026-09-06'}]}],'2026-09-05','2026-09-05');
 assert.equal(rows.find(row=>row[0]==='Meetings completed')[1],0);
});
