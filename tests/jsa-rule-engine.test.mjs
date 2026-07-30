import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../js/jsa-rule-engine.js", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const engine = sandbox.window.JsaRuleEngine;
const rules = JSON.parse(
  fs.readFileSync(new URL("../data/jsa-rules.json", import.meta.url), "utf8"),
).rules;

const maintenanceContext = {
  scenarios: ["maintenance"],
  selectedTags: ["mechanical", "chemical"],
  contractor_work: true,
  simultaneous_operations: false,
  non_routine: true,
  controlText: "加强培训，佩戴PPE",
  maxSeverity: 4,
};
const ids = engine
  .evaluateRules(rules, maintenanceContext, { includePending: true })
  .map((rule) => rule.rule_id);

for (const expected of [
  "JSA-ENERGY-001",
  "JSA-CHEM-001",
  "JSA-CONTRACTOR-001",
  "JSA-NONROUTINE-001",
  "JSA-CONTROL-001",
  "JSA-EMERGENCY-001",
]) {
  assert.ok(ids.includes(expected), `开发者单元测试应触发${expected}`);
}
assert.ok(!ids.includes("JSA-HOTWORK-001"), "不应触发动火规则");
assert.equal(
  engine.evaluateRules(rules, maintenanceContext, { includePending: false }).length,
  0,
  "缺少黄金案例或生产就绪状态的规则不得进入生产规则集",
);

const productionFixture = structuredClone(
  rules.find((rule) => rule.rule_id === "JSA-HOTWORK-001"),
);
productionFixture.production_status = "production_ready";
productionFixture.golden_case_ids = ["JSA-GOLD-TEST"];
assert.equal(
  engine.filterUsableRules([productionFixture], {includePending: false}).length,
  1,
  "同时满足专业批准、生产就绪和黄金案例覆盖的规则才可加载",
);

console.log(JSON.stringify({ status: "PASS", triggeredInDeveloperFixture: ids }));
