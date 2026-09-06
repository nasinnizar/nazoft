import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('CRM loads the shared accessible alert system', async () => {
  const [html, script, css, app] = await Promise.all([
    read('index.html'), read('scripts/alerts.js'), read('styles/alerts.css'), read('src/app.js')
  ]);
  assert.match(html, /id="toast"[^>]*aria-live="polite"/);
  assert.match(html, /scripts\/alerts\.js/);
  assert.match(html, /styles\/alerts\.css/);
  assert.match(app, /'alerts\.js'/);
  assert.match(script, /window\.toast = function toast/);
  assert.match(script, /crm-alert-close/);
  assert.match(script, /MutationObserver/);
  assert.match(script, /element\?\.matches\?\.\(inlineAlertSelector\)/);
  assert.match(css, /\.crm-alert-success/);
  assert.match(css, /\.crm-alert-destructive/);
  assert.match(css, /\.crm-alert-warning/);
  assert.match(css, /prefers-reduced-motion/);
});

test('alert classification covers success, warning, error, and informational feedback', async () => {
  const script = await read('scripts/alerts.js');
  assert.match(script, /saved\|created\|updated\|sent/);
  assert.match(script, /error\|failed\|failure\|unable/);
  assert.match(script, /choose\|select\|enter\|add\|required/);
  assert.match(script, /return 'info'/);
});
