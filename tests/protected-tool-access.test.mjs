import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bridgeCode = read('js/protected-tool-bridge.js');
const protectedTools = [
  'apollo-rca-tool.html',
  'content-repurposer.html',
  'fmea-tool.html',
  'tripod-beta-tool.html',
  'what-if-guide.html',
  'what-if-tool.html',
];

test('all public placeholders use the membership bridge and secure fallback', () => {
  for (const filename of protectedTools) {
    const page = read(`tools/${filename}`);
    const expectedPath = `/tools/${filename}`;
    assert.match(page, new RegExp(`data-protected-tool-path="${expectedPath.replaceAll('.', '\\.')}"`));
    assert.match(page, /js\/auth\.js\?v=2\.3\.0/);
    assert.match(page, /js\/protected-tool-bridge\.js\?v=1\.0\.0/);
    assert.match(page, new RegExp(`https://vip-api\\.ehs-sil\\.com${expectedPath.replaceAll('.', '\\.')}`));
    assert.doesNotMatch(page, /此公开页面不再包含工具源码或激活数据/);
  }
});

test('active members are sent to the allowlisted Worker tool URL', async () => {
  let replacedWith = '';
  const state = {};
  const action = {};
  const nodes = {
    '[data-bridge-title]': {},
    '[data-bridge-message]': {},
    '[data-bridge-action]': action,
  };
  const root = {
    getAttribute: () => '/tools/what-if-tool.html',
    querySelector: (selector) => nodes[selector] || null,
    setAttribute: (name, value) => { state[name] = value; },
  };
  const window = {
    EhsSilVip: { getSession: async () => ({ active: true, status: 'active' }) },
    location: { replace: (value) => { replacedWith = value; } },
  };
  vm.runInNewContext(bridgeCode, {
    window,
    document: { querySelector: () => root },
    encodeURIComponent,
    Promise,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(replacedWith, 'https://vip-api.ehs-sil.com/tools/what-if-tool.html');
  assert.equal(state['data-bridge-status'], 'active');
});

test('inactive members are returned to the public verification page', async () => {
  const state = {};
  const action = {};
  const nodes = {
    '[data-bridge-title]': {},
    '[data-bridge-message]': {},
    '[data-bridge-action]': action,
  };
  const root = {
    getAttribute: () => '/tools/fmea-tool.html',
    querySelector: (selector) => nodes[selector] || null,
    setAttribute: (name, value) => { state[name] = value; },
  };
  const window = {
    EhsSilVip: { getSession: async () => ({ active: false, status: 'inactive' }) },
    location: { replace: () => assert.fail('inactive sessions must not enter a protected tool') },
  };
  vm.runInNewContext(bridgeCode, {
    window,
    document: { querySelector: () => root },
    encodeURIComponent,
    Promise,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(action.href, '/dashboard/register.html?returnTo=%2Ftools%2Ffmea-tool.html');
  assert.equal(state['data-bridge-status'], 'inactive');
});
