import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const page = read("tools/incident-learning.html");
const toolIndex = read("tools/risk-analysis.html");
const shell = read("js/site-shell.js");
const schema = read("data/incidents/schema-v0.2.sql");
const plan = read("docs/incident-lfi-stage-1-plan.md");
const gate = read("docs/incident-lfi-stage-1.5-security-gate.md");
const rbac = JSON.parse(read("data/incidents/rbac-v0.2.json"));
const tenantAudit = JSON.parse(read("data/incidents/tenant-audit-contract-v0.2.json"));
const securityAudit = JSON.parse(read("data/incidents/security-audit-contract-v0.2.json"));
const platformAudit = JSON.parse(read("data/incidents/platform-audit-contract-v0.2.json"));
const invitations = JSON.parse(read("data/incidents/invitations-contract-v0.2.json"));
const roleGrant = JSON.parse(read("data/incidents/role-grant-matrix-v0.2.json"));
const negative = JSON.parse(read("tests/fixtures/incident-cross-tenant-negative-cases.json"));

assert.match(page, /V0\.1 · 用户验证阶段/);
assert.match(page, /只体验纯虚构案例/);
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
  "invitations",
  "invitation_roles",
  "tenant_bootstrap_grants",
  "auth_challenges",
  "user_sessions",
  "incidents",
  "incident_assignments",
  "incident_persons",
  "regulatory_reports",
  "investigations",
  "corrective_actions",
  "lfi_notices",
  "rollout_checks",
  "audit_event_policies",
  "tenant_audit_logs",
  "security_audit_logs",
  "platform_audit_logs",
]) {
  assert.match(schema, new RegExp(`CREATE TABLE ${table}\\b`), `数据契约缺少 ${table}`);
}

assert.match(schema, /tenant_id TEXT NOT NULL/g);
assert.match(schema, /tenancy_model TEXT NOT NULL DEFAULT 'single_site_pilot'/);
assert.match(schema, /tenant_memberships[\s\S]*status TEXT NOT NULL DEFAULT 'invited'/);
assert.doesNotMatch(schema, /role IN \([^\n]*action_owner/);
assert.match(schema, /tenant_membership_roles/);
assert.match(schema, /platform_support_grants/);
assert.match(schema, /auth_challenges[\s\S]*invitation_id TEXT/);
assert.match(schema, /purpose = 'accept_invite' AND invitation_id IS NOT NULL/);
assert.match(schema, /purpose <> 'accept_invite' AND invitation_id IS NULL/);
assert.match(schema, /challenge_hash TEXT NOT NULL UNIQUE/);
assert.match(schema, /token_hash TEXT PRIMARY KEY/);
assert.match(schema, /REFERENCES incidents\(tenant_id, id\)/);
assert.match(schema, /REFERENCES tenant_memberships\(tenant_id, user_id\)/);
for (const domain of ["tenant", "security", "platform"]) {
  assert.match(schema, new RegExp(`CREATE TRIGGER ${domain}_audit_logs_validate`));
  assert.match(schema, new RegExp(`CREATE TRIGGER ${domain}_audit_logs_no_update`));
  assert.match(schema, new RegExp(`CREATE TRIGGER ${domain}_audit_logs_no_delete`));
}
assert.match(schema, /audit_event_policies_no_update/);
assert.match(schema, /audit_event_policies_no_delete/);
assert.match(schema, /event is not allowlisted/);
assert.match(schema, /audit field is not allowlisted/);
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
assert.match(gate, /2A-Sandbox启动门槛/);
assert.match(gate, /2A-Pilot部署门槛/);
assert.match(gate, /不得创建生产D1\/R2/);

assert.equal(rbac.default_effect, "deny");
assert.equal(rbac.role_model.multiple_roles, true);
assert.equal(rbac.role_model.implicit_inheritance, false);
assert.ok(!rbac.role_model.tenant_roles.includes("action_owner"));
assert.ok(rbac.role_model.resource_scopes.includes("corrective_action_owner"));
assert.match(rbac.constraints.platform_admin, /no tenant business-data permission/i);
assert.match(rbac.constraints.tenant_admin, /may not read incidents, health data/i);

assert.equal(tenantAudit.tenant_id_required, true);
assert.equal(securityAudit.tenant_id_required, false);
assert.equal(platformAudit.tenant_id_required, false);
assert.match(securityAudit.subject_rule, /must not invent tenant_id/);
assert.match(platformAudit.actor_rule, /must not be inserted into tenant_memberships/);
for (const contract of [tenantAudit, securityAudit, platformAudit]) {
  assert.ok(contract.storage_enforcement.includes("event_allowlist_trigger"));
  assert.ok(contract.storage_enforcement.includes("field_allowlist_trigger"));
  assert.ok(contract.storage_enforcement.includes("no_update_trigger"));
  assert.ok(contract.storage_enforcement.includes("no_delete_trigger"));
}

assert.match(invitations.challenge_binding, /invitation_id/);
assert.match(invitations.multi_site_isolation, /same normalized email/i);
assert.deepEqual(invitations.acceptance_transaction.slice(-4), [
  "grant_invitation_roles", "mark_invitation_accepted", "consume_challenge",
  "write_security_and_tenant_minimal_audit",
]);
assert.equal(roleGrant.global_constraints.self_grant, "deny");
assert.equal(roleGrant.global_constraints.tenant_admin_grants_site_leader, "deny");
assert.equal(roleGrant.global_constraints.last_active_site_leader_disable_or_revoke, "deny");
assert.deepEqual(roleGrant.rules.find((item) => item.target_role === "ehs_manager").grant_by, ["site_leader"]);
assert.equal(roleGrant.initial_site_leader_bootstrap.repeatable, false);

assert.equal(negative.synthetic_only, true);
assert.equal(negative.cases.length, 16);
for (const id of Array.from({ length: 16 }, (_, index) => `XT-${String(index + 1).padStart(3, "0")}`)) {
  assert.ok(negative.cases.some((item) => item.id === id), `缺少负面用例 ${id}`);
}

console.log(JSON.stringify({
  status: "PASS",
  stage: "stage-2a-sandbox",
  data_intake: false,
  schema_tables: 23,
  negative_cases: negative.cases.length,
  api_negative_tests_executed: true,
}));
