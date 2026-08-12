import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const schemaPath = path.join(root, "data/incidents/schema-v0.1.sql");
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
    "INSERT INTO users(id,email_normalized,status) VALUES('user-fixture-a','a@example.invalid','active')",
    "INSERT INTO tenant_memberships(tenant_id,user_id,status) VALUES('tenant-fixture-a','user-fixture-a','active')",
  ].join(";") + ";";
  execFileSync("sqlite3", [db], { input: setup });

  const crossTenantInsert = spawnSync("sqlite3", [db], {
    input: "PRAGMA foreign_keys=ON; INSERT INTO incidents(id,tenant_id,reference_no,title,occurred_at,category,created_by) VALUES('incident-fixture-b','tenant-fixture-b','B-001','虚构事件','2026-08-12T00:00:00Z','near_miss','user-fixture-a');",
    encoding: "utf8",
  });
  assert.notEqual(crossTenantInsert.status, 0, "跨租户创建人关联必须被数据库拒绝");
  assert.match(crossTenantInsert.stderr, /FOREIGN KEY constraint failed/);

  execFileSync("sqlite3", [db], {
    input: "INSERT INTO audit_logs(id,tenant_id,action,resource_type,resource_id,request_id,result) VALUES('audit-fixture-1','tenant-fixture-a','auth.access_denied','incident','incident-fixture-b','request-fixture-1','denied');",
  });
  for (const sql of [
    "UPDATE audit_logs SET result='allowed' WHERE id='audit-fixture-1';",
    "DELETE FROM audit_logs WHERE id='audit-fixture-1';",
  ]) {
    const attempt = spawnSync("sqlite3", [db], { input: sql, encoding: "utf8" });
    assert.notEqual(attempt.status, 0, "审计日志修改/删除必须被数据库拒绝");
    assert.match(attempt.stderr, /audit logs/);
  }

  console.log(JSON.stringify({ status: "PASS", schema: "v0.2", synthetic_only: true }));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
