import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/homepage-astra.css', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../js/homepage-astra.js', import.meta.url), 'utf8');

test('Astra homepage keeps one brand-led hero and the established two actions', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const hero = html.match(/<section class="hero[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(hero, /EHS人的<br>专业工具台/);
  assert.match(hero, />浏览专业工具</);
  assert.match(hero, />了解EHS-SIL</);
  assert.equal((hero.match(/class="btn /g) || []).length, 2);
});

test('task router exposes four keyboard-operable tabs and matching panels', () => {
  const tabIds = [...html.matchAll(/id="(task-tab-[^"]+)" role="tab"[^>]+aria-controls="([^"]+)"/g)];
  const panelIds = new Set([...html.matchAll(/id="(task-panel-[^"]+)" role="tabpanel"/g)].map((match) => match[1]));
  assert.equal(tabIds.length, 4);
  tabIds.forEach(([, , controlledPanel]) => assert.ok(panelIds.has(controlledPanel)));
  assert.match(js, /ArrowRight/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /Home/);
  assert.match(js, /End/);
});

test('homepage keeps operational hooks and orders proof before membership', () => {
  assert.match(html, /css\/homepage-astra\.css\?v=1\.0\.0/);
  assert.match(html, /js\/homepage-astra\.js\?v=1\.0\.0/);
  assert.equal((html.match(/data-membership-status/g) || []).length, 2);
  assert.match(html, /data-feedback-entry="header"/);
  assert.match(html, /data-feedback-entry="footer"/);
  assert.match(html, /data-astra-action="click-member"/);
  assert.match(js, /toolId: 'toolbox-membership'/);
  assert.ok(html.indexOf('id="workbench"') < html.indexOf('id="value"'));
  assert.ok(html.indexOf('id="about"') < html.indexOf('id="membership"'));
  assert.match(html, /鲁ICP备2026013311号-2/);
});

test('homepage visual layer stays scoped and supports reduced motion', () => {
  assert.match(html, /<body class="home-astra">/);
  assert.match(css, /\.home-astra/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(html, /style="/);
  assert.doesNotMatch(html, /href="#"/);
});
