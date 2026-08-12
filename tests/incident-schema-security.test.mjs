import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const schemaPath = path.join(root, "data/incidents/schema-v0.2.sql");
const schema = fs.readFileSync(schemaPath, "utf8");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ehs-lfi-schema-"));
const db = path.join(temp, "contract.sqlite");

try {
  execFileSync("sqlite3", [db], { input: schema });
  const membershipSql = execFileSync("sqlite3", [db, ".schema tenant_memberships"], { encoding: "utf8" });
  assert.match(membershipSql, /DEFAULT 'invited'/);
  assert.doesNotMatch(membershipSql, /action_owner/);

  const setup = [
    "PRAGMA foreign_keys=ON",
    "INSERT INTO tenants(id,name,site_name) VALUES('tenant-fixture-a','企业A','虚构工厂A'),('tenant-fixture-b','企业B','虚构工厂B')",
    "INSERT INTO users(id,email_normalized,status) VALUES('user-fixture-a','a@example.invalid','active'),('user-fixture-b','b@example.invalid','active'),('platform-user','platform@example.invalid','active')",
    "INSERT INTO tenant_memberships(tenant_id,user_id,status) VALUES('tenant-fixture-a','user-fixture-a','active'),('tenant-fixture-b','user-fixture-b','active')",
    "INSERT INTO platform_administrators(user_id,status) VALUES('platform-user','active')",
  ].join(";") + ";";
  execFileSync("sqlite3", [db], { input: setup });

  const crossTenantInsert = spawnSync("sqlite3", [db], {
    input: "PRAGMA foreign_keys=ON; INSERT INTO incidents(id,tenant_id,reference_no,title,occurred_at,category,created_by) VALUES('incident-fixture-b','tenant-fixture-b','B-001','虚构事件','2026-08-12T00:00:00Z','near_miss','user-fixture-a');",
    encoding: "utf8",
  });
  assert.notEqual(crossTenantInsert.status, 0, "跨租户创建人关联必须被数据库拒绝");
  assert.match(crossTenantInsert.stderr, /FOREIGN KEY constraint failed/);

  const inserts = {
    tenant_audit_logs: "INSERT INTO tenant_audit_logs(id,tenant_id,action,resource_type,resource_id,request_id,result) VALUES('audit-tenant-1','tenant-fixture-a','incident.status_changed','incident','incident-fixture-a','request-1','allowed')",
    security_audit_logs: "INSERT INTO security_audit_logs(id,action,subject_id,request_id,result) VALUES('audit-security-1','auth.recovery_requested','subject-fixture-1','request-2','allowed')",
    platform_audit_logs: "INSERT INTO platform_audit_logs(id,platform_actor_user_id,action,resource_type,resource_id,request_id,result) VALUES('audit-platform-1','platform-user','platform.deployment_changed','deployment','deployment-fixture-1','request-3','allowed')",
  };
  for (const [table, insert] of Object.entries(inserts)) {
    execFileSync("sqlite3", [db], { input: `${insert};` });
    for (const sql of [
      `UPDATE ${table} SET result='failed';`,
      `DELETE FROM ${table};`,
    ]) {
      const attempt = spawnSync("sqlite3", [db], { input: sql, encoding: "utf8" });
      assert.notEqual(attempt.status, 0, `${table}修改/删除必须被数据库拒绝`);
      assert.match(attempt.stderr, /audit logs/);
    }
  }

  for (const sql of [
    "INSERT INTO tenant_audit_logs(id,tenant_id,action,resource_type,resource_id,request_id,result) VALUES('bad-event','tenant-fixture-a','unknown.event','incident','i','r','denied');",
    "INSERT INTO tenant_audit_logs(id,tenant_id,action,resource_type,resource_id,allowed_values_json,request_id,result) VALUES('bad-field','tenant-fixture-a','incident.status_changed','incident','i','{\"title\":\"forbidden\"}','r','denied');",
    "INSERT INTO tenant_audit_logs(id,tenant_id,action,resource_type,resource_id,changed_fields_json,request_id,result) VALUES('bad-change','tenant-fixture-a','incident.fields_changed','incident','i','[\"health_details\"]','r','denied');",
    "INSERT INTO tenant_audit_logs(id,tenant_id,action,resource_type,resource_id,allowed_values_json,request_id,result) VALUES('bad-object','tenant-fixture-a','incident.status_changed','incident','i','{\"status\":{\"description\":\"forbidden\"}}','r','denied');",
    "INSERT INTO security_audit_logs(id,action,subject_id,allowed_values_json,request_id,result) VALUES('bad-security','auth.recovery_requested','s','{\"email\":\"forbidden\"}','r','denied');",
  ]) {
    const attempt = spawnSync("sqlite3", [db], { input: sql, encoding: "utf8" });
    assert.notEqual(attempt.status, 0, "白名单外事件或字段必须由写入层拒绝");
    assert.match(attempt.stderr, /not allowlisted|short scalar/);
  }

  const platformMembershipCount = execFileSync("sqlite3", [db, "SELECT COUNT(*) FROM tenant_memberships WHERE user_id='platform-user';"], { encoding: "utf8" }).trim();
  assert.equal(platformMembershipCount, "0", "平台管理员写入平台审计不应要求成为租户成员");

  execFileSync("sqlite3", [db], {
    input: [
      "PRAGMA foreign_keys=ON",
      "INSERT INTO invitations(id,tenant_id,invited_email_normalized,invited_by_user_id,expires_at) VALUES('invite-a','tenant-fixture-a','same@example.invalid','user-fixture-a','2026-08-13T00:00:00Z'),('invite-b','tenant-fixture-b','same@example.invalid','user-fixture-b','2026-08-13T00:00:00Z')",
      "INSERT INTO invitation_roles(tenant_id,invitation_id,role) VALUES('tenant-fixture-a','invite-a','reporter'),('tenant-fixture-b','invite-b','ehs_manager')",
      "INSERT INTO auth_challenges(id,invitation_id,email_normalized,challenge_hash,purpose,expires_at) VALUES('challenge-a','invite-a','same@example.invalid','hash-a','accept_invite','2026-08-13T00:00:00Z'),('challenge-b','invite-b','same@example.invalid','hash-b','accept_invite','2026-08-13T00:00:00Z')",
    ].join(";") + ";",
  });
  const invitationIsolation = execFileSync("sqlite3", [db, "SELECT COUNT(DISTINCT i.tenant_id || ':' || c.invitation_id) FROM invitations i JOIN auth_challenges c ON c.invitation_id=i.id WHERE i.invited_email_normalized='same@example.invalid';"], { encoding: "utf8" }).trim();
  assert.equal(invitationIsolation, "2", "同一邮箱的多个工厂邀请必须保持独立邀请与挑战绑定");

  const invitationCheck = spawnSync("sqlite3", [db], {
    input: "INSERT INTO auth_challenges(id,email_normalized,challenge_hash,purpose,expires_at) VALUES('challenge-fixture-1','invitee@example.invalid','hash-fixture-1','accept_invite','2026-08-13T00:00:00Z');",
    encoding: "utf8",
  });
  assert.notEqual(invitationCheck.status, 0, "accept_invite挑战必须绑定invitation_id");
  assert.match(invitationCheck.stderr, /CHECK constraint failed/);

  console.log(JSON.stringify({ status: "PASS", schema: "v0.2", audit_domains: 3, synthetic_only: true, api_negative_tests_executed: false }));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
