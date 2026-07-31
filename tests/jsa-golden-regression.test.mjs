import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../js/jsa-rule-engine.js", import.meta.url), "utf8");
const sandbox = {window: {}};
vm.runInNewContext(source, sandbox);

const rules = JSON.parse(
  fs.readFileSync(new URL("../data/jsa-rules.json", import.meta.url), "utf8"),
).rules;
const cases = JSON.parse(
  fs.readFileSync(new URL("./fixtures/jsa-golden-cases.json", import.meta.url), "utf8"),
).cases.filter((item) => item.status === "approved");

assert.equal(cases.length, 5, "应有5个已批准黄金案例");

for (const testCase of cases) {
  const triggered = sandbox.window.JsaRuleEngine
    .evaluateRules(rules, testCase.confirmed_input_context, {includePending: true})
    .map((rule) => rule.rule_id);

  assert.deepEqual(
    [...triggered].sort(),
    [...testCase.expected_triggered_rules].sort(),
    `${testCase.case_id}实际触发规则必须与专家确认结果完全一致`,
  );
  for (const forbidden of testCase.rules_that_must_not_trigger) {
    assert.ok(!triggered.includes(forbidden), `${testCase.case_id}错误触发${forbidden}`);
  }
  assert.equal(testCase.expert_confirmed_result.decision, "approved_for_regression_testing");
}

console.log(JSON.stringify({
  status: "PASS_APPROVED_GOLDEN_CASE_REGRESSION",
  approvedGoldenCases: cases.length,
  remainingToMinimum: 15,
}));
