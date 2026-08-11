import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const css = read("css/design-system.css");
const shell = read("js/site-shell.js");
const pages = [
  "index.html",
  "tools/index.html",
  "tools/jsa-tool.html",
  "tools/compliance-identification.html",
  "dashboard/register.html",
].map(read);

for (const token of [
  "--color-bg",
  "--color-primary",
  "--font-size-base",
  "--space-2",
  "--radius-md",
  "--shadow-md",
  "--container-max",
  "--transition-fast",
]) {
  assert.ok(css.includes(token), `缺少设计变量 ${token}`);
}

for (const component of [".ds-btn", ".ds-badge", ".ds-card", ".site-shell-header", ".site-shell-footer"]) {
  assert.ok(css.includes(component), `缺少公共组件 ${component}`);
}

assert.match(css, /min-height:\s*44px/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(shell, /aria-expanded/);
assert.match(shell, /ArrowDown/);
assert.match(shell, /event\.key !== 'Escape'/);
assert.match(pages[0], /class="skip-link"/);
for (const page of pages.slice(1)) {
  assert.match(page, /data-site-shell-header/);
  assert.match(page, /js\/site-shell\.js/);
}

console.log(JSON.stringify({ status: "PASS", tokens: 8, components: 5, adoptedPages: 5 }));
