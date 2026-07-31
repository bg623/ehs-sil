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
).cases.filter((item) => item.status === "pending_expert_confirmation");

assert.equal(cases.length, 5, "应有5个待专家确认候选案例");

for (const testCase of cases) {
  const triggered = sandbox.window.JsaRuleEngine
    .evaluateRules(rules, testCase.proposed_input_context, {includePending: true})
    .map((rule) => rule.rule_id);

  for (const expected of testCase.expected_triggered_rules) {
    assert.ok(triggered.includes(expected), `${testCase.case_id}候选观察未触发${expected}`);
  }
  for (const forbidden of testCase.rules_that_must_not_trigger) {
    assert.ok(!triggered.includes(forbidden), `${testCase.case_id}候选观察错误触发${forbidden}`);
  }
  assert.equal(testCase.expert_confirmed_result, null, `${testCase.case_id}仍不得视为专家确认`);
}

console.log(JSON.stringify({
  status: "PASS_CANDIDATE_OBSERVATION_ONLY",
  candidateCases: cases.length,
  approvedGoldenCases: 0,
}));
