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
test('reduced FlowButton adds no arrow and keeps the short fill animation', () => {
  const css = read('styles/flow-buttons.css');
  assert.match(css, /clip-path \.22s/);
  assert.match(css, /:is\(:hover,:focus-visible\)[\s\S]*border-radius:100px!important/);
  assert.doesNotMatch(css, /::after|mask:url|content:'→'/);
});
