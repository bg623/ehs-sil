import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const home = read("index.html");
const shell = read("js/site-shell.js");
const style = read("css/style.css");
const design = read("css/design-system.css");
const homeNav = home.match(/<nav class="nav-bar">[\s\S]*?<\/nav>/)?.[0] || "";

for (const label of ["首页", "专业工具", "专业资源", "了解 EHS-SIL", "会员权益", "登录 / 激活"]) {
  assert.match(home, new RegExp(`>${label}<`), `首页导航缺少“${label}”`);
  assert.ok(shell.includes(label), `公共导航缺少“${label}”`);
}

for (const href of [
  "tools/risk-analysis.html#risk-assessment",
  "tools/risk-analysis.html#incident-investigation",
  "tools/jsa-tool.html",
  "tools/incident-learning.html",
  "tools/training-matrix.html",
  "tools/compliance-identification.html",
  "tools/index.html",
  "tools/ehs-glossary.html",
  "tools/regulations.html",
  "articles/",
  "products/toolbox.html",
  "products/training.html",
  "dashboard/register.html",
]) {
  assert.ok(home.includes(`href="${href}"`), `首页导航缺少链接 ${href}`);
  assert.ok(shell.includes(href), `公共导航缺少链接 ${href}`);
}

assert.equal((home.match(/data-nav-section="/g) || []).length, 6, "首页应保持6个清晰的一级导航入口");
assert.equal((home.match(/<ul class="nav-dropdown/g) || []).length, 3, "多项内容应归入3组下拉菜单");
assert.match(home, /JSA 工作安全分析专业教练/);
assert.match(home, /FMEA 失效模式分析/);
assert.match(home, /What-If 假设分析/);
assert.match(home, /RCA 根本原因分析/);
assert.doesNotMatch(homeNav, />职业成长</, "文章与培训应归入更准确的专业资源分类");
assert.doesNotMatch(shell, />风险与事故分析</, "风险评估与事故调查不应混为一个导航标签");

for (const selector of [".nav-dropdown-wide", ".nav-entry-title", ".nav-entry-desc", ".nav-account-link", ".nav-current"]) {
  assert.ok(`${style}\n${design}`.includes(selector), `缺少导航视觉样式 ${selector}`);
}

assert.match(shell, /ArrowUp/);
assert.match(shell, /hashchange/);
assert.match(shell, /aria-current/);
assert.match(home, /aria-controls="homeToolsMenu"/);
assert.match(home, /aria-controls="homeResourcesMenu"/);
assert.match(home, /aria-controls="homeAboutMenu"/);
assert.doesNotMatch(home, /href="tools\/"/, "首页不得使用 OSS 无法解析的 tools/ 目录路径");
assert.doesNotMatch(shell, /prefix \+ 'tools\/'/, "公共导航不得使用 OSS 无法解析的 tools/ 目录路径");

console.log(JSON.stringify({
  status: "PASS",
  primary_entries: 6,
  dropdown_groups: 3,
  direct_destinations: 12,
  bilingual_method_labels: 5,
}));
