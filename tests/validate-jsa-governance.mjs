import fs from "node:fs";
import assert from "node:assert/strict";

const rules = JSON.parse(fs.readFileSync(new URL("../data/jsa-rules.json", import.meta.url)));
const sourceCatalog = JSON.parse(
  fs.readFileSync(new URL("../data/jsa-source-catalog.json", import.meta.url)),
);
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
  "source_refs",
  "source_review_status",
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
assert.equal(cases.real_case_count, 5, "应登记5份产品负责人提供的真实脱敏样本");
assert.equal(cases.candidate_case_count, 5, "应有5个待专家确认候选案例");
assert.equal(cases.approved_case_count, 0, "产品负责人确认前不得存在已批准黄金案例");

const ruleIds = new Set();
const sourcesById = sourceCatalog.sources;
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
  assert.ok(Array.isArray(rule.source_refs), `${rule.rule_id}来源引用字段必须为数组`);
  assert.ok(rule.source_refs.length > 0, `${rule.rule_id}至少需要一个来源引用`);
  assert.equal(rule.source_review_status, "product_owner_confirmed", `${rule.rule_id}来源尚未获产品负责人确认`);
  for (const sourceId of rule.source_refs) {
    const source = sourcesById[sourceId];
    assert.ok(source, `${rule.rule_id}引用不存在的来源${sourceId}`);
    assert.equal(source.status, "verified_current", `${sourceId}不是已核实现行来源`);
    assert.match(source.url, /^https:\/\//, `${sourceId}必须使用HTTPS官方来源`);
    assert.ok(source.title_zh && source.title_en, `${sourceId}缺少中英文标题`);
    assert.ok(source.publisher_zh && source.publisher_en, `${sourceId}缺少中英文发布机构`);
  }
  if (rule.status === "approved") {
    assert.ok(rule.reviewer, `${rule.rule_id}已批准但缺少审核人`);
    assert.match(rule.review_date || "", /^\d{4}-\d{2}-\d{2}$/, `${rule.rule_id}审核日期无效`);
    assert.doesNotMatch(rule.source, /待.*补充|待.*审核/, `${rule.rule_id}缺少专业来源`);
    assert.ok(rule.source_refs.length > 0, `${rule.rule_id}缺少已核实来源引用`);
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

assert.equal(rules.publication_status, "professionally_approved_not_production_ready");
assert.ok(Array.isArray(rules.approval_history) && rules.approval_history.length > 0);
assert.equal(rules.approval_history.at(-1).result, "approved_for_internal_testing");
assert.equal(rules.approval_history.at(-1).approval_date, "2026-07-31");
assert.equal(rules.rules.filter((rule) => rule.status === "approved").length, 11);
assert.equal(
  rules.rules.filter((rule) => rule.source_review_status === "product_owner_confirmed").length,
  11,
);
assert.equal(
  rules.rules.filter((rule) => rule.production_status === "blocked_pending_golden_case").length,
  11,
);

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
  } else if (testCase.status === "pending_expert_confirmation") {
    assert.ok(testCase.input_scenario, `${testCase.case_id}候选案例缺少输入场景`);
    assert.match(testCase.sample_reference || "", /^JSA-SAMPLE-\d{2}$/, `${testCase.case_id}样本引用无效`);
    assert.equal(testCase.expert_confirmed_result, null, `${testCase.case_id}不得虚构专家结论`);
    assert.equal(testCase.reviewer, null, `${testCase.case_id}不得预填审核人`);
    assert.equal(testCase.review_date, null, `${testCase.case_id}不得预填审核日期`);
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
    verifiedSources: Object.keys(sourcesById).length,
    status: "PASS",
  }),
);
