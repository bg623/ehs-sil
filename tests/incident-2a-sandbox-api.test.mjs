import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { IncidentSandboxService, createRequest } from "../sandbox/incident/service.mjs";
import { MockMail } from "../sandbox/incident/mock-mail.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const schemaPath = path.join(root, "data/incidents/schema-v0.2.sql");

async function call(service, path, options) {
  const response = await service.fetch(createRequest(path, options));
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function makeFixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ehs-lfi-2a-"));
  const mail = new MockMail();
  const service = new IncidentSandboxService({ database: path.join(temp, "sandbox.sqlite"), schemaPath, mail });
  const A = {
    reporter: { id: "user-a-reporter", email: "reporter@a.example.invalid", roles: ["reporter"] },
    investigator: { id: "user-a-investigator", email: "investigator@a.example.invalid", roles: ["investigator"] },
    ehs: { id: "user-a-ehs", email: "ehs@a.example.invalid", roles: ["ehs_manager"] },
    leader: { id: "user-a-leader", email: "leader@a.example.invalid", roles: ["site_leader"] },
    admin: { id: "user-a-admin", email: "admin@a.example.invalid", roles: ["tenant_admin"] },
    owner: { id: "user-a-owner", email: "owner@a.example.invalid", roles: ["reporter"] },
  };
  const B = {
    reporter: { id: "user-b-reporter", email: "reporter@b.example.invalid", roles: ["reporter"] },
    ehs: { id: "user-b-ehs", email: "ehs@b.example.invalid", roles: ["ehs_manager"] },
    leader: { id: "user-b-leader", email: "leader@b.example.invalid", roles: ["site_leader"] },
  };
  service.seedTenant({ tenantId: "tenant-a", siteName: "虚构A工厂", users: Object.values(A) });
  service.seedTenant({ tenantId: "tenant-b", siteName: "虚构B工厂", users: Object.values(B) });
  service.seedPlatformAdmin({ id: "platform-admin", email: "platform@ops.example.invalid" });
  const tokens = {};
  for (const [key, user] of Object.entries(A)) tokens[`a_${key}`] = service.createSession(user.id, "tenant-a");
  for (const [key, user] of Object.entries(B)) tokens[`b_${key}`] = service.createSession(user.id, "tenant-b");
  tokens.platform = service.createSession("platform-admin", null);
  const createB = service.run(`INSERT INTO incidents(id,tenant_id,reference_no,title,occurred_at,category,created_by)
    VALUES('incident-b','tenant-b','B-001','虚构B工厂事件','2026-08-12T00:00:00Z','near_miss',?)`, B.reporter.id);
  assert.equal(createB.changes, 1);
  service.run(`INSERT INTO incidents(id,tenant_id,reference_no,title,occurred_at,category,created_by)
    VALUES('incident-a','tenant-a','A-001','虚构A工厂事件','2026-08-12T00:00:00Z','near_miss',?)`, A.reporter.id);
  service.run("INSERT INTO incident_persons(id,tenant_id,incident_id,encrypted_identity,encrypted_health_details) VALUES('person-a','tenant-a','incident-a','sandbox-cipher-identity','sandbox-cipher-health')");
  service.run(`INSERT INTO corrective_actions(id,tenant_id,incident_id,owner_user_id,action_text,due_at)
    VALUES('action-a','tenant-a','incident-a',?,'虚构整改措施','2026-09-01T00:00:00Z')`, A.owner.id);
  service.run("INSERT INTO incident_assignments(tenant_id,incident_id,investigator_user_id) VALUES('tenant-a','incident-a',?)", A.investigator.id);
  return { service, mail, temp, A, B, tokens, close() { service.close(); fs.rmSync(temp, { recursive: true, force: true }); } };
}

test("2A-Sandbox：16项API负面场景真实执行", async (t) => {
  const fx = makeFixture();
  t.after(() => fx.close());
  const { service: s, tokens } = fx;

  await t.test("XT-001 A租户读取B事件", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-b", { token: tokens.a_ehs })).status, 404);
  });
  await t.test("XT-002 A租户搜索B事件不泄露存在性", async () => {
    const result = await call(s, "/sandbox/incidents/search?q=虚构B工厂事件", { token: tokens.a_ehs });
    assert.equal(result.status, 200); assert.deepEqual(result.body.items, []);
  });
  await t.test("XT-003 A租户修改B事件", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-b", { method: "PATCH", token: tokens.a_ehs, body: { title: "篡改" } })).status, 404);
  });
  await t.test("XT-004 A租户删除B事件", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-b", { method: "DELETE", token: tokens.a_leader, body: {} })).status, 404);
  });
  await t.test("XT-005 A租户申请B附件签名", async () => {
    const result = await call(s, "/sandbox/incidents/incident-b/attachments/file-b/sign", { method: "POST", token: tokens.a_ehs, body: {} });
    assert.equal(result.status, 404); assert.equal(result.body.signed_url, undefined);
  });
  await t.test("XT-006 URL、Header和Body tenant_id篡改", async () => {
    const attempts = [
      call(s, "/sandbox/incidents?tenant_id=tenant-b", { method: "POST", token: tokens.a_reporter, body: { title: "虚构事件" } }),
      call(s, "/sandbox/incidents", { method: "POST", token: tokens.a_reporter, headers: { "x-tenant-id": "tenant-b" }, body: { title: "虚构事件" } }),
      call(s, "/sandbox/incidents", { method: "POST", token: tokens.a_reporter, body: { tenant_id: "tenant-b", title: "虚构事件" } }),
    ];
    for (const result of await Promise.all(attempts)) { assert.equal(result.status, 403); assert.equal(result.body.error, "tenant_context_tampered"); }
  });
  await t.test("XT-007 reporter越权关闭事件", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-a/close", { method: "POST", token: tokens.a_reporter, body: {} })).status, 403);
  });
  await t.test("XT-008 tenant_admin读取事故和健康信息", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-a", { token: tokens.a_admin })).status, 403);
    assert.equal((await call(s, "/sandbox/incidents/incident-a/health", { token: tokens.a_admin })).status, 403);
  });
  await t.test("XT-009 disabled用户复用旧会话", async () => {
    s.run("UPDATE users SET status='disabled' WHERE id=?", fx.A.reporter.id);
    const result = await call(s, "/sandbox/incidents/incident-a", { token: tokens.a_reporter });
    assert.equal(result.status, 401); assert.equal(result.body.error, "session_revoked");
    assert.ok(s.one("SELECT revoked_at FROM user_sessions WHERE token_hash IS NOT NULL AND user_id=? ORDER BY created_at DESC LIMIT 1", fx.A.reporter.id).revoked_at);
  });
  await t.test("XT-010 邀请重复消费", async () => {
    const created = await call(s, "/sandbox/invitations", { method: "POST", token: tokens.a_admin, body: { email: "repeat@invite.example.invalid", roles: ["reporter"] } });
    const message = fx.mail.latest("repeat@invite.example.invalid", "accept_invite");
    const body = { email: message.to, challenge: message.challenge };
    assert.equal((await call(s, `/sandbox/invitations/${created.body.invitation_id}/accept`, { method: "POST", body })).status, 200);
    assert.equal((await call(s, `/sandbox/invitations/${created.body.invitation_id}/accept`, { method: "POST", body })).status, 409);
  });
  await t.test("XT-011 过期邀请", async () => {
    const created = await call(s, "/sandbox/invitations", { method: "POST", token: tokens.a_admin, body: { email: "expired@invite.example.invalid", roles: ["reporter"], ttl_seconds: -1 } });
    const message = fx.mail.latest("expired@invite.example.invalid", "accept_invite");
    assert.equal((await call(s, `/sandbox/invitations/${created.body.invitation_id}/accept`, { method: "POST", body: { email: message.to, challenge: message.challenge } })).status, 410);
  });
  await t.test("XT-012 邀请暴力尝试被限速并审计", async () => {
    const created = await call(s, "/sandbox/invitations", { method: "POST", token: tokens.a_admin, body: { email: "limited@invite.example.invalid", roles: ["reporter"] } });
    let result;
    for (let index = 0; index < 3; index += 1) result = await call(s, `/sandbox/invitations/${created.body.invitation_id}/accept`, { method: "POST", body: { email: "limited@invite.example.invalid", challenge: `wrong-${index}` } });
    assert.equal(result.status, 429);
    assert.ok(s.one("SELECT 1 FROM security_audit_logs WHERE action='auth.rate_limited' AND subject_id=?", created.body.invitation_id));
  });
  await t.test("XT-013 A租户跨租户导出", async () => {
    const result = await call(s, "/sandbox/incidents/incident-b/export", { method: "POST", token: tokens.a_ehs, body: {} });
    assert.equal(result.status, 404); assert.equal(result.body.export_id, undefined);
  });
  await t.test("XT-014 三类审计日志禁止修改", async () => {
    const ids = seedThreeAudits(fx);
    for (const [domain, id] of Object.entries(ids)) assert.equal((await call(s, `/sandbox/audit/${domain}/${id}`, { method: "PATCH", token: tokens.a_leader, body: {} })).status, 409);
  });
  await t.test("XT-015 三类审计日志禁止删除", async () => {
    const ids = latestThreeAuditIds(s);
    for (const [domain, id] of Object.entries(ids)) assert.equal((await call(s, `/sandbox/audit/${domain}/${id}`, { method: "DELETE", token: tokens.a_leader, body: {} })).status, 409);
  });
  await t.test("XT-016 platform_admin读取租户业务数据", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-a", { token: tokens.platform })).status, 403);
  });
});

function seedThreeAudits(fx) {
  const { service: s } = fx;
  s.tenantAudit({ tenantId: "tenant-a", actor: fx.A.leader.id, action: "incident.status_changed", resourceType: "incident", resourceId: "incident-a", changed: ["status"], values: { status: "reported" } });
  s.securityAudit({ action: "auth.access_denied", subjectId: "subject-sandbox", result: "denied", reason: "sandbox_test" });
  s.platformAudit({ actor: "platform-admin", action: "platform.deployment_changed", resourceType: "sandbox", resourceId: "local-only", changed: ["deployment_status"], values: { deployment_status: "local" } });
  return latestThreeAuditIds(s);
}

function latestThreeAuditIds(service) {
  return {
    tenant: service.one("SELECT id FROM tenant_audit_logs ORDER BY rowid DESC LIMIT 1").id,
    security: service.one("SELECT id FROM security_audit_logs ORDER BY rowid DESC LIMIT 1").id,
    platform: service.one("SELECT id FROM platform_audit_logs ORDER BY rowid DESC LIMIT 1").id,
  };
}

test("2A-Sandbox：正向流程、邀请恢复、会话和RBAC", async (t) => {
  const fx = makeFixture();
  t.after(() => fx.close());
  const { service: s, tokens } = fx;

  await t.test("邀请创建与接受，Mock邮件且同事务激活", async () => {
    const created = await call(s, "/sandbox/invitations", { method: "POST", token: tokens.a_admin, body: { email: "new@person.example.invalid", roles: ["reporter"] } });
    assert.equal(created.status, 201);
    const message = fx.mail.latest("new@person.example.invalid", "accept_invite"); assert.ok(message);
    const accepted = await call(s, `/sandbox/invitations/${created.body.invitation_id}/accept`, { method: "POST", body: { email: message.to, challenge: message.challenge } });
    assert.equal(accepted.status, 200); assert.ok(accepted.body.token);
    assert.equal(s.one("SELECT status FROM invitations WHERE id=?", created.body.invitation_id).status, "accepted");
  });
  await t.test("reporter创建并查看本人事件", async () => {
    const created = await call(s, "/sandbox/incidents", { method: "POST", token: tokens.a_reporter, body: { title: "虚构人员轻微事件", reference_no: "A-NEW" } });
    assert.equal(created.status, 201);
    assert.equal((await call(s, `/sandbox/incidents/${created.body.id}`, { token: tokens.a_reporter })).status, 200);
  });
  await t.test("investigator查看获分配事件", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-a", { token: tokens.a_investigator })).status, 200);
  });
  await t.test("ehs_manager完成初步分级", async () => {
    const result = await call(s, "/sandbox/incidents/incident-a/triage", { method: "POST", token: tokens.a_ehs, body: { actual_consequence: "low", potential_consequence: "medium", investigation_level: "basic" } });
    assert.equal(result.status, 200); assert.equal(result.body.status, "triaged");
  });
  await t.test("site_leader关闭事件", async () => {
    assert.equal((await call(s, "/sandbox/incidents/incident-a/close", { method: "POST", token: tokens.a_leader, body: {} })).body.status, "closed");
  });
  await t.test("action owner更新本人措施", async () => {
    const result = await call(s, "/sandbox/corrective-actions/action-a", { method: "PATCH", token: tokens.a_owner, body: { status: "in_progress" } });
    assert.equal(result.status, 200); assert.equal(result.body.status, "in_progress");
  });
  await t.test("合法角色授予和撤销，同时禁止自我提权与保护最后site_leader", async () => {
    assert.equal((await call(s, `/sandbox/members/${fx.A.reporter.id}/roles`, { method: "POST", token: tokens.a_leader, body: { role: "ehs_manager" } })).status, 201);
    assert.equal((await call(s, `/sandbox/members/${fx.A.reporter.id}/roles/ehs_manager`, { method: "DELETE", token: tokens.a_leader, body: {} })).status, 200);
    assert.equal((await call(s, `/sandbox/members/${fx.A.admin.id}/roles`, { method: "POST", token: tokens.a_admin, body: { role: "site_leader" } })).status, 403);
    assert.equal((await call(s, `/sandbox/members/${fx.A.leader.id}/roles/site_leader`, { method: "DELETE", token: tokens.a_leader, body: {} })).status, 409);
    assert.equal((await call(s, `/sandbox/members/${fx.A.leader.id}/status`, { method: "PATCH", token: tokens.a_admin, body: { status: "disabled" } })).status, 409);
    assert.equal((await call(s, "/sandbox/roles/site-leader/replace", { method: "POST", token: tokens.a_leader, body: { target_user_id: fx.A.ehs.id } })).body.error, "step_up_required");
  });
  await t.test("合法审计写入与租户审计读取", async () => {
    seedThreeAudits(fx);
    const result = await call(s, "/sandbox/audit/tenant", { token: tokens.a_ehs });
    assert.equal(result.status, 200); assert.ok(result.body.items.length >= 1);
    assert.equal((await call(s, "/sandbox/audit/security", { token: tokens.platform })).status, 200);
    assert.equal((await call(s, "/sandbox/audit/platform", { token: tokens.platform })).status, 200);
    const serialized = JSON.stringify({
      tenant: s.all("SELECT * FROM tenant_audit_logs"),
      security: s.all("SELECT * FROM security_audit_logs"),
      platform: s.all("SELECT * FROM platform_audit_logs"),
    });
    for (const forbidden of ["虚构A工厂事件", "sandbox-cipher-identity", "sandbox-cipher-health", tokens.a_ehs]) assert.equal(serialized.includes(forbidden), false);
  });
  await t.test("账号恢复撤销旧会话并创建新会话", async () => {
    const requested = await call(s, "/sandbox/auth/recovery/request", { method: "POST", body: { email: fx.A.ehs.email } });
    assert.equal(requested.status, 202);
    const message = fx.mail.latest(fx.A.ehs.email, "recover_account"); assert.ok(message);
    const accepted = await call(s, "/sandbox/auth/recovery/accept", { method: "POST", body: { email: fx.A.ehs.email, challenge: message.challenge } });
    assert.equal(accepted.status, 200); assert.ok(accepted.body.token);
    assert.equal((await call(s, "/sandbox/incidents/incident-a", { token: tokens.a_ehs })).status, 401);
    assert.equal((await call(s, "/sandbox/incidents/incident-a", { token: accepted.body.token })).status, 200);
  });
  await t.test("模拟登录解析active_tenant_id且会话可主动撤销", async () => {
    const login = await call(s, "/sandbox/auth/login", { method: "POST", body: { email: fx.A.leader.email } });
    assert.equal(login.status, 200); assert.equal(login.body.active_tenant_id, "tenant-a");
    assert.equal((await call(s, "/sandbox/auth/logout", { method: "POST", token: login.body.token, body: {} })).status, 204);
    assert.equal((await call(s, "/sandbox/incidents/incident-a", { token: login.body.token })).status, 401);
  });
  await t.test("过期会话被拒绝", async () => {
    const expired = s.createSession(fx.A.leader.id, "tenant-a", -1);
    const result = await call(s, "/sandbox/incidents/incident-a", { token: expired });
    assert.equal(result.status, 401); assert.equal(result.body.error, "session_invalid");
  });
  await t.test("附件签名为本地模拟且不创建R2对象", async () => {
    const result = await call(s, "/sandbox/incidents/incident-a/attachments/fake-file/sign", { method: "POST", token: tokens.a_leader, body: {} });
    assert.equal(result.status, 200); assert.match(result.body.signed_url, /^sandbox:\/\//); assert.equal(result.body.r2_object_created, false);
  });
});
