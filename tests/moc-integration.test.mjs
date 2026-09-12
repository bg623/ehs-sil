import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const home = read('index.html');
const shell = read('js/site-shell.js');
const toolIndex = read('tools/index.html');

function runShell({ local = false, readyState = 'complete', existingFeatures = false } = {}) {
  const appended = [];
  const domReady = [];
  const header = { innerHTML: '', getAttribute: (name) => name === 'data-prefix' ? '../' : null };
  const footer = { ...header };
  let membershipCalls = 0;
  const document = {
    body: { getAttribute: (name) => name === 'data-site-shell-features' && local ? 'local' : null },
    currentScript: { src: 'https://ehs-sil.com/js/site-shell.js?v=20260912' },
    readyState,
    querySelector: () => null,
    querySelectorAll: (selector) => selector === '[data-site-shell-header]' ? [header] :
      selector === '[data-site-shell-footer]' ? [footer] : [],
    createElement: (tagName) => ({ tagName, dataset: {}, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; } }),
    addEventListener: (type, callback) => { if (type === 'DOMContentLoaded') domReady.push(callback); },
    head: { appendChild(node) {
      appended.push(node);
      if (node.tagName === 'script') queueMicrotask(() => node.listeners.load?.());
    } },
  };
  const window = existingFeatures ? {
    EhsSilMembershipUI: { render() { membershipCalls += 1; } },
    EhsSilVip: { getState() { membershipCalls += 1; return {}; } },
  } : {};
  vm.runInNewContext(shell, { document, window, URL, Promise, Boolean,
    location: { href: 'https://ehs-sil.com/tools/moc-coach.html' } });
  return { appended, domReady, header, footer, membershipCalls };
}

test('local MOC shell renders navigation without shared scripts, session calls or feedback capture', async () => {
  for (const readyState of ['complete', 'loading']) {
    const result = runShell({ local: true, readyState, existingFeatures: true });
    await new Promise(setImmediate);
    assert.equal(result.appended.length, 0, 'local tools must not load shared network features');
    assert.equal(result.membershipCalls, 0);
    assert.equal(result.domReady.length, 0);
    assert.match(result.header.innerHTML, /href="\.\.\/tools\/moc-coach\.html"/);
    assert.match(result.header.innerHTML, />会员入口<\/a>/);
    assert.doesNotMatch(result.header.innerHTML + result.footer.innerHTML, /data-membership-status|data-feedback-open|feedback\.html\?/);
    assert.match(result.footer.innerHTML, /href="\.\.\/feedback\.html">反馈建议/);
  }
});

test('MOC page opts into local-only loading and restricts document network access', () => {
  const page = read('tools/moc-coach.html');
  assert.match(page, /<body\b[^>]*data-site-shell-features="local"/);
  assert.match(page, /http-equiv="Content-Security-Policy"/);
  assert.match(page, /script-src 'self'/);
  assert.match(page, /connect-src 'self'/);
  assert.match(page, /name="referrer" content="no-referrer"/);
  for (const [, source] of page.matchAll(/<script[^>]*src="([^"]+)"/g)) {
    assert.ok(!/^(?:https?:)?\/\//.test(source), `third-party source: ${source}`);
    assert.doesNotMatch(source, /(?:analytics|auth|feedback|membership-ui|protected-tool-bridge)\.js/);
  }
  assert.doesNotMatch(page, /data-protected-tool-bridge|data-vip-gate|name="robots" content="noindex"/);
});

test('default site shell retains normal analytics, membership and feedback boot', async () => {
  const result = runShell();
  await new Promise(setImmediate);
  assert.deepEqual(result.appended.filter((node) => node.tagName === 'script').map((node) => new URL(node.src).pathname),
    ['/js/analytics.js', '/js/auth.js', '/js/membership-ui.js', '/js/feedback.js']);
  assert.match(result.header.innerHTML, /data-membership-status/);
  assert.match(result.header.innerHTML, /data-feedback-open/);
  const delayed = runShell({ readyState: 'loading' });
  assert.equal(delayed.domReady.length, 1);
  assert.equal(delayed.appended.filter((node) => node.tagName === 'script').length, 0);
});

test('MOC is discoverable and management practices keep separate, real destinations', () => {
  const practice = home.match(/<article[^>]*id="practice-tools"[\s\S]*?<\/article>/)?.[0] || '';
  for (const path of [
    'tools/bbs-tool.html',
    'tools/moc-coach.html',
    'articles/pipeline-isolation-lototo-blind-flange-dbb-guide.html',
    'articles/pssr-pre-startup-safety-review-checklist.html',
  ]) assert.ok(practice.includes(`href="${path}"`), path);
  assert.match(practice, /href="tools\/moc-coach\.html" class="workbench-link"/);
  assert.doesNotMatch(practice, /LOTO 上锁挂牌与 MOC/);
  assert.match(toolIndex, /href="moc-coach\.html"/);
  assert.match(read('tools/risk-analysis.html'), /href="moc-coach\.html"/);
  assert.equal((read('sitemap.xml').match(/<loc>https:\/\/ehs-sil\.com\/tools\/moc-coach\.html<\/loc>/g) || []).length, 1);
  assert.equal(JSON.parse(read('data/tools.json')).tools.some((item) => item.path === 'tools/moc-coach.html'), false,
    'MOC online discovery must not change the resource/download index contract');
});

test('tool-index search finds the MOC action without treating it as a downloadable resource', async () => {
  const source = [...toolIndex.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]).find((script) => script.includes('let toolsData = []'));
  const elements = Object.fromEntries(['searchInput', 'toolsGrid', 'resultCount', 'categoryFilters', 'toolCount', 'online-moc']
    .map((id) => [id, { style: {}, hidden: false, innerHTML: '', textContent: '', value: '', listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; } }]));
  const timers = new Map();
  let timerId = 0;
  const document = {
    getElementById: (id) => elements[id], querySelectorAll: () => [], addEventListener() {},
    createElement: () => ({ textContent: '', get innerHTML() { return this.textContent; } }),
  };
  vm.runInNewContext(source, { document, window: {},
    fetch: async () => ({ json: async () => ({ tools: [{ name: '培训资料', description: '培训课程', tags: ['培训'], category: '培训课件', path: 'training.pdf', format: 'pdf' }], categories: ['培训课件'] }) }),
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; }, clearTimeout: (id) => timers.delete(id),
  });
  await new Promise(setImmediate);
  function search(value) {
    elements.searchInput.value = value;
    elements.searchInput.listeners.input.call(elements.searchInput);
    for (const [id, fn] of [...timers.entries()]) { timers.delete(id); fn(); }
  }
  search('MOC');
  assert.equal(elements['online-moc'].hidden, false);
  assert.match(elements.resultCount.textContent, /1 个在线工具/);
  assert.match(elements.toolsGrid.innerHTML, /可使用上方 MOC 在线工具/);
  assert.equal(elements.toolCount.textContent, 1, 'resource inventory count must stay independent');
  search('培训');
  assert.equal(elements['online-moc'].hidden, true);
  assert.match(elements.toolsGrid.innerHTML, /培训资料/);
  search('变更管理');
  assert.equal(elements['online-moc'].hidden, false);
});
