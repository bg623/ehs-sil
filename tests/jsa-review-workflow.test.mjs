import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const reviewWorkflow = require("../js/jsa-review.js");
const ruleset = JSON.parse(
  fs.readFileSync(new URL("../data/jsa-rules.json", import.meta.url), "utf8"),
);
const reviewPage = fs.readFileSync(
  new URL("../dashboard/jsa-rule-review.html", import.meta.url),
  "utf8",
);
const adminPage = fs.readFileSync(
  new URL("../dashboard/admin.html", import.meta.url),
  "utf8",
);

const initialRuleJson = JSON.stringify(ruleset);
const state = reviewWorkflow.createReviewState(ruleset, null);
assert.equal(state.reviews.length, 11, "审核页必须加载全部候选规则");
assert.deepEqual(
  reviewWorkflow.summarize(state.reviews),
  {pending: 0, approved: 6, needs_revision: 5, rejected: 0},
);
assert.equal(state.reviewer, "Go by John");
assert.equal(state.review_date, "2026-07-30");

state.reviewer = "John Yu";
state.review_date = "2026-07-30";
state.reviews[0].decision = "approved";
state.reviews[0].source = "待产品负责人补充并审核来源";

let errors = reviewWorkflow.validateReview(
  state.reviews[0],
  state,
  new Set(ruleset.rules.map((rule) => rule.rule_id)),
);
assert.ok(errors.includes("批准前需要补充可追溯的专业来源"));

state.reviews[0].source = "产品负责人审核的企业危险能量控制程序，第4章";
errors = reviewWorkflow.validateReview(
  state.reviews[0],
  state,
  new Set(ruleset.rules.map((rule) => rule.rule_id)),
);
assert.deepEqual(errors, []);

state.reviews[1].decision = "needs_revision";
state.reviews[1].comments = "";
errors = reviewWorkflow.validateReview(
  state.reviews[1],
  state,
  new Set(ruleset.rules.map((rule) => rule.rule_id)),
);
assert.ok(errors.includes("需要填写修改或拒绝原因"));
state.reviews[1].comments = "补充设备打开前的介质确认要求";

const exported = reviewWorkflow.buildExport(
  ruleset,
  state,
  "2026-07-30T10:00:00.000Z",
);
assert.equal(exported.export_type, "jsa_product_owner_review");
assert.equal(exported.summary.approved, 7);
assert.equal(exported.summary.needs_revision, 4);
assert.equal(exported.summary.pending, 0);
assert.equal(exported.reviews[0].reviewer, "John Yu");
assert.equal(exported.reviews[2].reviewer, "John Yu");
assert.match(exported.notice, /不代表规则已通过黄金案例或生产发布门槛/);
assert.equal(JSON.stringify(ruleset), initialRuleJson, "审核流程不得直接修改生产规则数据");
assert.match(
  reviewWorkflow.describeTrigger(ruleset.rules[0].trigger_condition),
  /电气 electrical.*机械 mechanical/,
);
assert.match(
  reviewWorkflow.describeTrigger(ruleset.rules[6].trigger_condition),
  /同时作业 simultaneous_operations/,
);

assert.match(reviewPage, /本页面不会直接修改线上规则/);
assert.match(reviewPage, /下载审核结果/);
assert.match(reviewPage, /needs_revision/);
assert.match(reviewPage, /noindex,nofollow/);
assert.doesNotMatch(reviewPage, /password|token|activation.?code/i);
assert.match(adminPage, /href="jsa-rule-review\.html"/);
assert.doesNotMatch(adminPage, /密码保护/);

const inlineScripts = [...reviewPage.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(inlineScripts.length, 1);
assert.doesNotThrow(() => new Function(inlineScripts[0][1]));

console.log(JSON.stringify({
  status: "PASS",
  rules: state.reviews.length,
  exportedSummary: exported.summary,
}));
