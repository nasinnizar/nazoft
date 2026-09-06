import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../src/services/workspace.js', import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('const organizationPlanSeats'), source.indexOf('async function findMembership')).replace('export const permissionCatalog', 'const permissionCatalog'), context);
const identity = { email: 'sales@example.com', name: 'Sales' };
const mine = { id: 'mine', ownerEmail: identity.email, completedAt: 123 };
const other = { id: 'other', ownerEmail: 'other@example.com' };

test('members only receive their own tasks', () => {
  const filtered = context.filterWorkspaceForMember({tasks:[mine,other]}, identity);
  assert.equal(filtered.tasks.length, 1);
  assert.equal(filtered.tasks[0].id, 'mine');
});
test('task saves preserve other members and reject injected owners', () => {
  const merged = context.mergeWorkspaceForMember({tasks:[mine,other]}, {tasks:[{...mine,completedAt:456},{...other,title:'forged'}]}, identity, 'sales');
  assert.equal(merged.tasks.length, 2);
  assert.equal(merged.tasks.find(task=>task.id==='mine').completedAt, 456);
  assert.equal(merged.tasks.find(task=>task.id==='other').title, undefined);
});
test('older tabs without a tasks field preserve saved tasks', () => {
  const merged = context.mergeWorkspaceForMember({tasks:[mine,other]}, {}, identity, 'sales');
  assert.equal(merged.tasks.length, 2);
  assert.equal(merged.tasks.find(task=>task.id==='mine').completedAt, 123);
});
