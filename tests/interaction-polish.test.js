import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('account actions stay concise and appearance is managed in settings', () => {
  const html=read('index.html'),script=read('scripts/interaction-polish.js'),app=read('src/app.js');
  assert.match(html,/interaction-polish\.js/);
  assert.match(app,/interaction-polish\.js/);
  assert.match(script,/profileSettings'\)\?\.remove/);
  assert.match(script,/\.theme-options'\)\?\.remove/);
  assert.match(script,/crm-appearance-setting/);
  assert.match(script,/theme-transition/);
  assert.match(script,/dataset\.page = 'settings'/);
  assert.match(script,/nav\.append\(settingsButton\)/);
});

test('only major actions receive flow motion and contextual actions stay stable', () => {
  const script=read('scripts/settings-polish.js'),css=read('styles/interaction-polish.css');
  assert.match(script,/const majorAction=/);
  assert.match(script,/\.lead-followup-panel,#clientInfo/);
  assert.match(css,/#drawer \.lead-followup-panel \.row-actions \.btn/);
  assert.match(css,/#drawer #leadMenu \.btn/);
});

test('lead client actions close cleanly and support real contact sharing', () => {
  const script=read('scripts/lead-workspace-controls.js');
  assert.match(script,/lead-menu-close/);
  assert.match(script,/data-lead-action="notes"/);
  assert.match(script,/VERSION:3\.0/);
  assert.match(script,/navigator\.share/);
  assert.match(script,/navigator\.clipboard\.writeText/);
});

test('reports provide icon-led views and a functional attribution panel', () => {
  const script=read('scripts/reports-tasks.js'),css=read('styles/interaction-polish.css');
  assert.match(script,/reportViews/);
  assert.match(script,/sourcesReport/);
  assert.match(script,/renderSourcesProducts/);
  assert.match(script,/target==='sources'/);
  assert.match(css,/\.crm-report-tabs[\s\S]*grid-template-columns/);
});

test('sidebar supports long-press reordering and role-based destinations', () => {
  const html=read('index.html'),script=read('scripts/sidebar-customization.js'),app=read('src/app.js');
  assert.match(html,/sidebar-customization\.js/);
  assert.match(app,/sidebar-customization\.js/);
  assert.match(script,/setTimeout\(startArrange, 520\)/);
  assert.match(script,/localStorage\.setItem\(storageKey/);
  assert.match(script,/View proposals/);
  assert.match(script,/role-hidden/);
  assert.match(script,/Your role cannot open this area/);
});

test('proposal creation and downloads use separate permissions while channel actions stay removed', () => {
  const script=read('scripts/proposals.js'),service=read('src/services/workspace.js');
  assert.match(script,/hasPermission\('Create proposals'\)/);
  assert.match(script,/hasPermission\('Download proposals'\)/);
  assert.doesNotMatch(script,/Send via WhatsApp|Send via Email|Confirm sent|data-preview/);
  assert.match(service,/assertProposalChangesAllowed/);
});

test('closing a client dialog preserves the client workspace and follow-up defaults stay quiet', () => {
  const html=read('index.html');
  assert.match(html,/closest\('\.modal,\.drawer'\)/);
  assert.doesNotMatch(html,/\$\$\('\.modal,\.drawer'\)\.forEach/);
  assert.match(html,/!document\.querySelector\('\.modal\.open,dialog\[open\]'\)/);
  assert.doesNotMatch(html,/Auto-filled from your Follow-up automation settings/);
  assert.doesNotMatch(html,/#editLead[^;]+\$\('#drawer'\)\.classList\.remove\('open'\)/);
});
