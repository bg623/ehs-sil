import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const page = read("tools/incident-learning.html");
const toolIndex = read("tools/risk-analysis.html");
const shell = read("js/site-shell.js");
const schema = read("data/incidents/schema-v0.1.sql");
const plan = read("docs/incident-lfi-stage-1-plan.md");

assert.match(page, /第1阶段 · 试点准备/);
assert.match(page, /当前不收集真实事故数据/);
assert.match(page, /不得因等待系统判断而延误救援或法定报告/);
assert.doesNotMatch(page, /<form\b/i, "第1周页面不得出现真实数据表单");
assert.doesNotMatch(page, /<input\b|<textarea\b|type=["']file["']/i, "第1周页面不得采集事故或附件");
assert.match(page, /visit_incident_lfi/);
assert.match(page, /incident_resource_click/);

assert.match(toolIndex, /incident-learning\.html/);
assert.match(shell, /tools\/incident-learning\.html/);

for (const table of [
  "tenants",
  "users",
  "tenant_memberships",
  "auth_challenges",
  "user_sessions",
  "incidents",
  "incident_persons",
  "regulatory_reports",
  "investigations",
  "corrective_actions",
  "lfi_notices",
  "rollout_checks",
  "audit_logs",
]) {
  assert.match(schema, new RegExp(`CREATE TABLE ${table}\\b`), `数据契约缺少 ${table}`);
}

assert.match(schema, /tenant_id TEXT NOT NULL/g);
assert.match(schema, /challenge_hash TEXT NOT NULL UNIQUE/);
assert.match(schema, /token_hash TEXT PRIMARY KEY/);
assert.match(schema, /REFERENCES incidents\(tenant_id, id\)/);
assert.match(schema, /REFERENCES tenant_memberships\(tenant_id, user_id\)/);
assert.match(schema, /audit_logs_no_update/);
assert.match(schema, /audit_logs_no_delete/);
assert.match(schema, /encrypted_health_details/);
assert.match(plan, /前端角色只用于改善界面/);
assert.match(plan, /Incident Worker/);
assert.match(plan, /跨租户自动测试/);

console.log(JSON.stringify({
  status: "PASS",
  stage: "week-1-safe-entry",
  data_intake: false,
  schema_tables: 13,
}));
