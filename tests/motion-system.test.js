import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('live shell uses the reduced FlowButton animation', () => {
  const html = read('index.html');
  assert.match(html, /styles\/flow-buttons\.css/);
  assert.doesNotMatch(html, /href="\/styles\/(?:motion|button)-system\.css/);
  assert.match(read('scripts/settings-polish.js'), /syncFlowButtons/);
});
test('collapsed sidebar previews on hover and header controls are circular', () => {
  assert.match(read('scripts/mobile-sidebar.js'), /pointerenter.*previewSidebar/);
  const css = read('styles/flow-buttons.css');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /outline-color:var\(--blue\)/);
  assert.doesNotMatch(css, /mask:url/);
  const polish = read('styles/settings-polish.css');
  assert.match(polish, /sidebar-collapsed \.side \.nav button[\s\S]*border-radius:50%!important/);
  assert.match(polish, /sidebar-collapsed \.side \.nav button > span[\s\S]*min-width:0!important/);
  assert.match(polish, /#sidebarToggle,#notificationButton[\s\S]*border-radius:50%!important/);
});
test('FlowButton adds no arrow and keeps the approved premium animation', () => {
  const css = read('styles/flow-buttons.css');
  assert.match(css, /clip-path \.52s/);
  assert.match(css, /button\.crm-flow-button\.btn\.primary/);
  assert.match(css, /#leadMenu button\.crm-flow-button\.btn\.danger \{ border-radius:100px!important; \}/);
  assert.match(css, /:is\(:hover,:focus-visible\)[\s\S]*border-radius:100px!important/);
  assert.match(css, /:is\(:hover,:focus-visible\)[\s\S]*translateY\(-1px\)/);
  assert.doesNotMatch(css, /::after|mask:url|content:'→'/);
});
test('header actions keep stable geometry under the shared animation', () => {
  const css = read('styles/flow-buttons.css');
  assert.match(css, /:is\(#quickActivity,\.top-actions \.addLead\)[\s\S]*min-width:104px/);
  assert.doesNotMatch(css, /:is\(#quickActivity,\.top-actions \.addLead\)[^{]*\{[^}]*border-radius:/);
});
test('sidebar hover preview uses the slower premium easing', () => {
  const css = read('styles/settings-polish.css');
  const script = read('scripts/mobile-sidebar.js');
  assert.match(css, /grid-template-columns \.52s cubic-bezier\(\.22,\.61,\.36,1\)/);
  assert.match(css, /sidebar-wordmark[\s\S]*opacity \.52s cubic-bezier\(\.22,\.61,\.36,1\)/);
  assert.match(css, /\.app \.side \.profile[\s\S]*height:58px[\s\S]*margin:auto 0 0!important/);
  assert.match(css, /profileAvatar[\s\S]*flex:0 0 36px!important/);
  assert.match(script, /button\[data-page\][\s\S]*requestAnimationFrame[\s\S]*closePreview\(true\)/);
});
test('all CRM calendars share the Tasks two-month surface', () => {
  const polish = read('scripts/settings-polish.js');
  const reports = read('scripts/reports-tasks.js');
  const css = read('styles/reports-tasks.css') + read('styles/settings-polish.css');
  assert.match(polish, /crm-date-months task-range-months/);
  assert.match(polish, /activeDateInput\?\.type==='time'\?322:748/);
  assert.match(reports, /report-calendar-months/);
  assert.match(reports, /for\(let offset=0;offset<2;offset\+\+\)/);
  assert.match(css, /width:min\(748px,calc\(100vw - 16px\)\)/);
  assert.match(css, /report-calendar-months[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
