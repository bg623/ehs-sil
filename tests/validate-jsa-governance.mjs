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
  "review_notes",
  "status",
  "production_status",
  "golden_case_ids",
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
const goldenCasesById = new Map(
  cases.cases.map((testCase) => [testCase.case_id, testCase]),
);
const allowedRuleStatuses = new Set([
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "retired",
  "rejected",
]);
const allowedProductionStatuses = new Set([
  "blocked_pending_product_owner_review",
  "blocked_pending_product_owner_reapproval",
  "blocked_pending_golden_case",
  "production_ready",
  "retired",
]);
for (const rule of rules.rules) {
  for (const field of ruleFields) assert.ok(field in rule, `${rule.rule_id}缺少${field}`);
  assert.ok(!ruleIds.has(rule.rule_id), `规则编号重复：${rule.rule_id}`);
  ruleIds.add(rule.rule_id);
  assert.ok(allowedRuleStatuses.has(rule.status), `${rule.rule_id}审核状态无效`);
  assert.ok(
    allowedProductionStatuses.has(rule.production_status),
    `${rule.rule_id}生产状态无效`,
  );
  assert.ok(Array.isArray(rule.golden_case_ids), `${rule.rule_id}黄金案例字段必须为数组`);
  if (rule.status === "approved") {
    assert.ok(rule.reviewer, `${rule.rule_id}已批准但缺少审核人`);
    assert.match(rule.review_date || "", /^\d{4}-\d{2}-\d{2}$/, `${rule.rule_id}审核日期无效`);
    assert.doesNotMatch(rule.source, /待.*补充|待.*审核/, `${rule.rule_id}缺少专业来源`);
  }
  if (rule.status === "changes_requested") {
    assert.ok(rule.reviewer, `${rule.rule_id}缺少提出修改意见的审核人`);
    assert.match(rule.review_date || "", /^\d{4}-\d{2}-\d{2}$/, `${rule.rule_id}审核日期无效`);
    assert.ok(rule.review_notes, `${rule.rule_id}缺少修改意见`);
  }
  if (rule.production_status === "production_ready") {
    assert.equal(rule.status, "approved", `${rule.rule_id}尚未专业批准`);
    assert.ok(rule.golden_case_ids.length > 0, `${rule.rule_id}缺少黄金案例覆盖`);
    for (const caseId of rule.golden_case_ids) {
      const goldenCase = goldenCasesById.get(caseId);
      assert.ok(goldenCase, `${rule.rule_id}引用不存在的黄金案例${caseId}`);
      assert.equal(goldenCase.status, "approved", `${caseId}尚未完成专家确认`);
    }
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
    changesRequestedRules: rules.rules.filter(
      (rule) => rule.status === "changes_requested",
    ).length,
    productionReadyRules: rules.rules.filter(
      (rule) => rule.production_status === "production_ready",
    ).length,
    goldenCaseSlots: cases.cases.length,
    approvedGoldenCases: cases.cases.filter((item) => item.status === "approved").length,
    status: "PASS",
  }),
);
