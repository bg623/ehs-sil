import fs from "node:fs";
import assert from "node:assert/strict";

const rules = JSON.parse(fs.readFileSync(new URL("../data/jsa-rules.json", import.meta.url)));
const cases = JSON.parse(
  fs.readFileSync(new URL("./fixtures/jsa-golden-cases.json", import.meta.url)),
);

const ruleFields = [
  "rule_id",
  "rule_name",
  "applicable_scenario",
  "trigger_condition",
  "risk_category",
  "prompt_text",
  "reason",
  "recommended_action",
  "severity",
  "source",
  "version",
  "reviewer",
  "review_date",
  "status",
];
const caseFields = [
  "case_id",
  "status",
  "input_scenario",
  "expected_triggered_rules",
  "rules_that_must_not_trigger",
  "critical_risk_omissions",
  "expert_confirmed_result",
  "sample_reference",
  "reviewer",
  "review_date",
];

assert.equal(cases.cases.length, 20, "必须保留20个黄金案例槽位");
assert.equal(cases.real_case_count, 0, "尚未收到产品负责人样本时，真实案例数必须为0");

const ruleIds = new Set();
for (const rule of rules.rules) {
  for (const field of ruleFields) assert.ok(field in rule, `${rule.rule_id}缺少${field}`);
  assert.ok(!ruleIds.has(rule.rule_id), `规则编号重复：${rule.rule_id}`);
  ruleIds.add(rule.rule_id);
  if (rule.status === "approved") {
    assert.ok(rule.reviewer, `${rule.rule_id}已批准但缺少审核人`);
    assert.match(rule.review_date || "", /^\d{4}-\d{2}-\d{2}$/, `${rule.rule_id}审核日期无效`);
  }
}

const caseIds = new Set();
for (const testCase of cases.cases) {
  for (const field of caseFields) assert.ok(field in testCase, `${testCase.case_id}缺少${field}`);
  assert.ok(!caseIds.has(testCase.case_id), `案例编号重复：${testCase.case_id}`);
  caseIds.add(testCase.case_id);

  if (testCase.status === "approved") {
    assert.ok(testCase.input_scenario, `${testCase.case_id}缺少输入场景`);
    assert.ok(testCase.expert_confirmed_result, `${testCase.case_id}缺少专家确认结果`);
    assert.ok(testCase.reviewer, `${testCase.case_id}缺少审核人`);
    for (const id of [
      ...testCase.expected_triggered_rules,
      ...testCase.rules_that_must_not_trigger,
    ]) {
      assert.ok(ruleIds.has(id), `${testCase.case_id}引用不存在的规则${id}`);
    }
  } else {
    assert.equal(
      testCase.status,
      "awaiting_product_owner_input",
      `${testCase.case_id}具有未经支持的状态`,
    );
  }
}

console.log(
  JSON.stringify({
    rules: rules.rules.length,
    approvedRules: rules.rules.filter((rule) => rule.status === "approved").length,
    goldenCaseSlots: cases.cases.length,
    approvedGoldenCases: cases.cases.filter((item) => item.status === "approved").length,
    status: "PASS",
  }),
);
