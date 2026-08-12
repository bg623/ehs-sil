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
const gate = read("docs/incident-lfi-stage-1.5-security-gate.md");
const rbac = JSON.parse(read("data/incidents/rbac-v0.2.json"));
const audit = JSON.parse(read("data/incidents/audit-event-allowlist-v0.2.json"));
const negative = JSON.parse(read("tests/fixtures/incident-cross-tenant-negative-cases.json"));

assert.match(page, /阶段1\.5 · 产品与安全闸门/);
assert.match(page, /当前不收集真实事故数据/);
assert.match(page, /一个租户等于一个工厂/);
assert.match(page, /不得因等待系统判断而延误救援或法定报告/);
assert.doesNotMatch(page, /<form\b/i, "第1周页面不得出现真实数据表单");
assert.doesNotMatch(page, /<input\b|<textarea\b|type=["']file["']/i, "第1周页面不得采集事故或附件");
assert.match(page, /visit_incident_lfi/);
assert.match(page, /incident_resource_click/);

assert.match(toolIndex, /incident-learning\.html/);
assert.match(shell, /tools\/incident-learning\.html/);
assert.match(toolIndex, /id=["']incident-investigation["']/);
assert.match(page, /href=["']risk-analysis\.html#incident-investigation["']/);

for (const table of [
  "tenants",
  "users",
  "tenant_memberships",
  "tenant_membership_roles",
  "platform_administrators",
  "platform_support_grants",
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
assert.match(schema, /tenancy_model TEXT NOT NULL DEFAULT 'single_site_pilot'/);
assert.match(schema, /tenant_memberships[\s\S]*status TEXT NOT NULL DEFAULT 'invited'/);
assert.doesNotMatch(schema, /role IN \([^\n]*action_owner/);
assert.match(schema, /tenant_membership_roles/);
assert.match(schema, /platform_support_grants/);
assert.match(schema, /challenge_hash TEXT NOT NULL UNIQUE/);
assert.match(schema, /token_hash TEXT PRIMARY KEY/);
assert.match(schema, /REFERENCES incidents\(tenant_id, id\)/);
assert.match(schema, /REFERENCES tenant_memberships\(tenant_id, user_id\)/);
assert.match(schema, /audit_logs_no_update/);
assert.match(schema, /audit_logs_no_delete/);
assert.doesNotMatch(schema, /before_json|after_json/);
assert.match(schema, /changed_fields_json/);
assert.match(schema, /allowed_values_json/);
assert.match(schema, /result TEXT NOT NULL CHECK/);
assert.match(schema, /encrypted_health_details/);
assert.match(plan, /前端角色只用于改善界面/);
assert.match(plan, /Incident Worker/);
assert.match(plan, /跨租户自动测试/);
assert.match(gate, /一个tenant（租户）只代表一个site/);
assert.match(gate, /服务端tenant_id解析规则/);
assert.match(gate, /阶段2A验收标准/);
assert.match(gate, /不得创建生产D1\/R2/);

assert.equal(rbac.default_effect, "deny");
assert.equal(rbac.role_model.multiple_roles, true);
assert.equal(rbac.role_model.implicit_inheritance, false);
assert.ok(!rbac.role_model.tenant_roles.includes("action_owner"));
assert.ok(rbac.role_model.resource_scopes.includes("corrective_action_owner"));
assert.match(rbac.constraints.platform_admin, /no tenant business-data permission/i);
assert.match(rbac.constraints.tenant_admin, /may not read incidents, health data/i);

assert.equal(audit.policy, "deny_unlisted");
assert.ok(audit.forbidden_payload_keys.includes("before_json"));
assert.ok(audit.forbidden_payload_keys.includes("health_details"));
assert.ok(!audit.record_shape.includes("before_json"));
assert.ok(!audit.record_shape.includes("after_json"));
assert.ok(audit.record_shape.includes("changed_fields_json"));

assert.equal(negative.synthetic_only, true);
assert.equal(negative.cases.length, 16);
for (const id of Array.from({ length: 16 }, (_, index) => `XT-${String(index + 1).padStart(3, "0")}`)) {
  assert.ok(negative.cases.some((item) => item.id === id), `缺少负面用例 ${id}`);
}

console.log(JSON.stringify({
  status: "PASS",
  stage: "stage-1.5-security-gate",
  data_intake: false,
  schema_tables: 16,
  negative_cases: negative.cases.length,
}));
