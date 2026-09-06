import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('workflow shortcuts and pipeline controls are loaded', () => {
  const html = read('index.html');
  const app = read('src/app.js');
  assert.match(html, /workflow-shortcuts\.js/);
  assert.match(html, /workflow-shortcuts\.css/);
  assert.match(app, /workflow-shortcuts\.js/);
});

test('keyboard actions and enter-to-advance are implemented', () => {
  const script = read('scripts/workflow-shortcuts.js');
  assert.match(script, /Meta\+Shift\+L/);
  assert.match(script, /Meta\+Shift\+A/);
  assert.match(script, /Meta\+Shift\+T/);
  assert.match(script, /event\.key !== 'Enter'/);
  assert.match(script, /next\.focus\(\)/);
});

test('pipeline filter toggle and sort label are exposed', () => {
  const script = read('scripts/workflow-shortcuts.js');
  assert.match(script, /Sort by/);
  assert.match(script, /Show filters/);
  assert.match(script, /aria-controls/);
});

test('task overdue state uses a dot rather than a rail', () => {
  const css = read('styles/reports-tasks.css');
  assert.match(css, /crm-task-row\.overdue:before/);
  assert.doesNotMatch(css, /crm-task-row\.overdue\s*\{[^}]*border-left\s*:\s*3px/);
});

test('settings groups do not trigger generic opening notifications', () => {
  const script = read('scripts/settings-navigation.js');
  assert.match(script, /event\.stopPropagation\(\)/);
});

test('proposal editor omits manual channel and confirmation actions', () => {
  const script = read('scripts/proposals.js');
  assert.doesNotMatch(script, /Send via WhatsApp|Send via Email|Confirm sent|Download PDF to attach|Open Email|data-preview/);
  assert.match(script, /data-download/);
});
