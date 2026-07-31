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
  controlEntries: ["加强培训，佩戴PPE"],
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

const mixedControlContext = {
  scenarios: ["maintenance"],
  selectedTags: ["mechanical"],
  controlText: "佩戴PPE，并使用盲板隔离、上锁挂牌和机械防护罩",
  controlEntries: ["佩戴PPE，并使用盲板隔离、上锁挂牌和机械防护罩"],
  maxSeverity: 2,
};
const controlRule = rules.find((rule) => rule.rule_id === "JSA-CONTROL-001");
assert.equal(
  engine.evaluateRules([controlRule], mixedControlContext, {includePending: true}).length,
  0,
  "同时存在更高层级控制时，不得仅因出现PPE字样误报",
);

const stepLevelControlContext = {
  ...mixedControlContext,
  controlEntries: ["认真操作，佩戴手套", "使用盲板隔离并上锁挂牌"],
};
assert.equal(
  engine.evaluateRules([controlRule], stepLevelControlContext, {includePending: true}).length,
  1,
  "任一作业步骤仅依赖PPE或行为提醒时应提示控制层级",
);
const productionIds = engine
  .evaluateRules(rules, maintenanceContext, { includePending: false })
  .map((rule) => rule.rule_id);
assert.deepEqual(
  productionIds,
  ids,
  "最终上线批准后，生产规则集应与已审核规则产生一致结果",
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

const blockedFixture = structuredClone(productionFixture);
blockedFixture.production_status = "blocked_pending_product_owner_launch_approval";
assert.equal(
  engine.filterUsableRules([blockedFixture], {includePending: false}).length,
  0,
  "未进入生产就绪状态的规则不得加载",
);

console.log(JSON.stringify({ status: "PASS", triggeredInDeveloperFixture: ids }));
