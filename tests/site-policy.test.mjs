import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const home = read("index.html");
const jsa = read("tools/jsa-tool.html");
const register = read("dashboard/register.html");
const toolbox = read("products/toolbox.html");
const rules = JSON.parse(read("data/jsa-rules.json"));

const hero = home.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0] || "";
assert.match(hero, /检查或创建一份[\s\S]*更专业的 JSA/);
assert.match(hero, />开始JSA检查</);
assert.match(hero, />使用示例体验</);
assert.equal(
  (hero.match(/class="btn /g) || []).length,
  2,
  "首页第一屏只允许两个JSA行动按钮",
);

assert.doesNotMatch(jsa, /JSA得分|质量良好/);
assert.doesNotMatch(jsa, /function\s+(?:exportToExcel|saveToLocal|loadFromLocal)\s*\(/);
for (const status of ["已覆盖", "建议关注", "需要人工确认"]) {
  assert.match(jsa, new RegExp(status));
}
assert.match(jsa, /不代表作业安全、法规符合、作业批准或风险可接受/);

assert.match(register, /停止销售29\.9元独立VIP/);
assert.doesNotMatch(register, /付款二维码|扫码支付|立即购买29\.9/);
assert.doesNotMatch(`${home}\n${register}\n${toolbox}`, /一次付费.{0,8}永久使用/);
assert.match(toolbox, /129/);
assert.match(toolbox, /元\/年/);

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
    hero_actions: 2,
    candidate_rules: rules.rules.length,
    deployment_ready_rules: 0,
  }),
);
