import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('settings use grouped accessible disclosure navigation', async () => {
  const [html, script, css, app] = await Promise.all([
    read('index.html'), read('scripts/settings-navigation.js'), read('styles/settings-navigation.css'), read('src/app.js')
  ]);
  assert.match(html, /scripts\/settings-navigation\.js/);
  assert.match(html, /styles\/settings-navigation\.css/);
  assert.match(app, /'settings-navigation\.js'/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /aria-controls/);
  assert.match(script, /settings-group-items/);
  assert.match(css, /\.settings-nav-group\.is-open/);
  assert.match(css, /\.settings-group-items\[hidden\]/);
});

test('all settings destinations are assigned to a concise category', async () => {
  const [html, script] = await Promise.all([read('index.html'), read('scripts/settings-navigation.js')]);
  const keys = new Set([...html.matchAll(/data-setting="([^"]+)"/g)].map(match => match[1]));
  ['regional', 'company', 'branding', 'numbering', 'fields', 'pipelines', 'products', 'groups', 'sources', 'documents', 'sequences', 'followups', 'contactRules', 'notifications', 'personalisation', 'leadForms', 'meta', 'google', 'website', 'data', 'users', 'access', 'workHours', 'profile'].forEach(key => {
    assert.match(script, new RegExp(`\\['${key}',`));
  });
  assert.doesNotMatch(script, /\['templates',/);
  assert.ok(keys.has('fields') && keys.has('users') && keys.has('profile'));
});
