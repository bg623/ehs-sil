import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const home = read("index.html");
const jsa = read("tools/jsa-tool.html");
const register = read("dashboard/register.html");
const toolbox = read("products/toolbox.html");
const riskAnalysis = read("tools/risk-analysis.html");
const rules = JSON.parse(read("data/jsa-rules.json"));

const hero = home.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] || "";
assert.match(home, /<title>EHS-SIL · 外企EHS实操指南<\/title>/);
assert.match(hero, /外企EHS<br>实操指南/);
assert.match(hero, />了解产品</);
assert.match(hero, />免费阅读</);
assert.match(hero, />搜索工具库</);
assert.match(hero, />风险分析</);
assert.match(hero, />事故调查</);
assert.match(hero, />BBS观察</);
assert.doesNotMatch(hero, />开始JSA检查|>使用示例体验/);
assert.equal(
  (hero.match(/class="btn /g) || []).length,
  6,
  "首页第一屏应保持JSA项目启动前的六个行动按钮",
);
assert.match(home, /href="tools\/" class="nav-link">工具库</);
assert.match(home, /risk-analysis\.html#risk-assessment" class="nav-link">风险分析</);
assert.doesNotMatch(home, /class="nav-link">JSA专业教练</);

assert.doesNotMatch(jsa, /JSA得分|质量良好/);
assert.doesNotMatch(jsa, /function\s+(?:exportToExcel|saveToLocal|loadFromLocal)\s*\(/);
for (const status of ["已覆盖", "建议关注", "需要人工确认"]) {
  assert.match(jsa, new RegExp(status));
}
assert.match(jsa, /不代表作业安全、法规符合、作业批准或风险可接受/);

assert.match(register, /停止销售29\.9元独立VIP/);
assert.doesNotMatch(register, /付款二维码|扫码支付|立即购买29\.9/);
assert.doesNotMatch(`${register}\n${toolbox}`, /一次付费.{0,8}永久使用/);
assert.match(toolbox, /129/);
assert.match(toolbox, /元\/年/);
assert.match(riskAnalysis, /<h3>JSA 工作安全分析<\/h3>/);
assert.match(riskAnalysis, /专业教练 V0\.1/);
assert.match(riskAnalysis, /href="jsa-tool\.html"[^>]*>开始JSA分析/);

assert.equal(rules.publication_status, "pending_product_owner_review");
assert.ok(rules.rules.length > 0);
assert.ok(
  rules.rules.every(
    (rule) =>
      rule.status === "pending_review" &&
      rule.reviewer === null &&
      rule.review_date === null,
  ),
  "候选规则在产品负责人审核前不得标记为已批准",
);

console.log(
  JSON.stringify({
    status: "PASS",
    hero_actions: 6,
    jsa_location: "risk-analysis",
    candidate_rules: rules.rules.length,
    deployment_ready_rules: 0,
  }),
);
