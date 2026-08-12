import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { MockMail } from "./mock-mail.mjs";

const ROLE_RULES = {
  reporter: ["tenant_admin", "site_leader"],
  investigator: ["tenant_admin", "ehs_manager", "site_leader"],
  tenant_admin: ["site_leader"],
  ehs_manager: ["site_leader"],
  site_leader: [],
};

const PERMISSIONS = {
  "incident.create": ["reporter", "investigator", "ehs_manager", "site_leader"],
  "incident.read_tenant": ["ehs_manager", "site_leader"],
  "incident.triage": ["ehs_manager", "site_leader"],
  "incident.close": ["site_leader"],
  "incident.delete": ["site_leader"],
  "health.read": ["investigator", "ehs_manager", "site_leader"],
  "export.create": ["ehs_manager", "site_leader"],
  "audit.read": ["ehs_manager", "site_leader"],
};

class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const hash = (value) => createHash("sha256").update(value).digest("hex");
const nowIso = () => new Date().toISOString();
const futureIso = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();
const opaqueSubject = (email) => `subject:${hash(email).slice(0, 20)}`;

function json(status, body) {
  if (status === 204) return new Response(null, { status, headers: { "cache-control": "no-store" } });
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export class IncidentSandboxService {
  constructor({ database = ":memory:", schemaPath, mail = new MockMail(), maxInviteAttempts = 3 } = {}) {
    this.db = new DatabaseSync(database);
    this.db.exec("PRAGMA foreign_keys=ON");
    this.db.exec(fs.readFileSync(schemaPath, "utf8"));
    this.mail = mail;
    this.maxInviteAttempts = maxInviteAttempts;
    this._counter = 0;
  }

  close() { this.db.close(); }
  id(prefix) { this._counter += 1; return `${prefix}-${this._counter}-${randomUUID()}`; }
  token() { return randomBytes(24).toString("base64url"); }
  one(sql, ...params) { return this.db.prepare(sql).get(...params); }
  all(sql, ...params) { return this.db.prepare(sql).all(...params); }
  run(sql, ...params) { return this.db.prepare(sql).run(...params); }

  seedTenant({ tenantId, siteName, users }) {
    this.run("INSERT INTO tenants(id,name,site_name,status) VALUES(?,?,?,'pilot')", tenantId, `虚构${siteName}`, siteName);
    for (const user of users) {
      if (!user.email.endsWith(".example.invalid")) throw new Error("Synthetic email required");
      this.run("INSERT OR IGNORE INTO users(id,email_normalized,display_name,status) VALUES(?,?,?,'active')", user.id, user.email, user.name ?? "虚构人员");
      this.run("INSERT INTO tenant_memberships(tenant_id,user_id,status) VALUES(?,?,'active')", tenantId, user.id);
      for (const role of user.roles ?? []) this.run("INSERT INTO tenant_membership_roles(tenant_id,user_id,role) VALUES(?,?,?)", tenantId, user.id, role);
    }
  }

  seedPlatformAdmin({ id, email }) {
    if (!email.endsWith(".example.invalid")) throw new Error("Synthetic email required");
    this.run("INSERT INTO users(id,email_normalized,status) VALUES(?,?,'active')", id, email);
    this.run("INSERT INTO platform_administrators(user_id,status) VALUES(?,'active')", id);
  }

  createSession(userId, tenantId, ttlSeconds = 3600) {
    const token = this.token();
    this.run("INSERT INTO user_sessions(token_hash,user_id,active_tenant_id,expires_at) VALUES(?,?,?,?)", hash(token), userId, tenantId, futureIso(ttlSeconds));
    return token;
  }

  tenantAudit({ tenantId, actor = null, action, resourceType, resourceId, changed = [], values = {}, result = "allowed", reason = null }) {
    this.run(`INSERT INTO tenant_audit_logs(id,tenant_id,actor_user_id,action,resource_type,resource_id,changed_fields_json,allowed_values_json,request_id,result,reason_code)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, this.id("taudit"), tenantId, actor, action, resourceType, resourceId, JSON.stringify(changed), JSON.stringify(values), this.id("request"), result, reason);
  }

  securityAudit({ actor = null, action, subjectId, changed = [], values = {}, result = "allowed", reason = null }) {
    this.run(`INSERT INTO security_audit_logs(id,actor_user_id,action,subject_id,changed_fields_json,allowed_values_json,request_id,result,reason_code)
      VALUES(?,?,?,?,?,?,?,?,?)`, this.id("saudit"), actor, action, subjectId, JSON.stringify(changed), JSON.stringify(values), this.id("request"), result, reason);
  }

  platformAudit({ actor, action, resourceType, resourceId, tenantReferenceId = null, changed = [], values = {}, result = "allowed", reason = null }) {
    this.run(`INSERT INTO platform_audit_logs(id,platform_actor_user_id,action,resource_type,resource_id,tenant_reference_id,changed_fields_json,allowed_values_json,request_id,result,reason_code)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, this.id("paudit"), actor, action, resourceType, resourceId, tenantReferenceId, JSON.stringify(changed), JSON.stringify(values), this.id("request"), result, reason);
  }

  async body(request) {
    if (!request.body) return {};
    try { return await request.json(); } catch { throw new ApiError(400, "invalid_json"); }
  }

  authenticate(request) {
    const value = request.headers.get("authorization") ?? "";
    if (!value.startsWith("Bearer ")) throw new ApiError(401, "authentication_required");
    const tokenHash = hash(value.slice(7));
    const session = this.one(`SELECT s.*,u.status AS user_status,m.status AS membership_status
      FROM user_sessions s JOIN users u ON u.id=s.user_id
      LEFT JOIN tenant_memberships m ON m.tenant_id=s.active_tenant_id AND m.user_id=s.user_id
      WHERE s.token_hash=?`, tokenHash);
    if (!session || session.revoked_at || session.expires_at <= nowIso()) throw new ApiError(401, "session_invalid");
    if (session.user_status !== "active" || (session.active_tenant_id && session.membership_status !== "active")) {
      this.run("UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE token_hash=?", nowIso(), tokenHash);
      throw new ApiError(401, "session_revoked");
    }
    const roles = session.active_tenant_id ? this.all("SELECT role FROM tenant_membership_roles WHERE tenant_id=? AND user_id=?", session.active_tenant_id, session.user_id).map((row) => row.role) : [];
    const platform = this.one("SELECT 1 FROM platform_administrators WHERE user_id=? AND status='active'", session.user_id);
    return { ...session, roles, platformAdmin: Boolean(platform), tokenHash };
  }

  rejectTenantTamper(request, body, session) {
    const url = new URL(request.url);
    const candidates = [body?.tenant_id, request.headers.get("x-tenant-id"), url.searchParams.get("tenant_id")].filter(Boolean);
    if (candidates.some((tenant) => tenant !== session.active_tenant_id)) throw new ApiError(403, "tenant_context_tampered");
  }

  requireTenant(session) {
    if (!session.active_tenant_id || session.platformAdmin) throw new ApiError(403, "tenant_access_denied");
  }

  permits(session, permission) { return (PERMISSIONS[permission] ?? []).some((role) => session.roles.includes(role)); }
  requirePermission(session, permission) { if (!this.permits(session, permission)) throw new ApiError(403, "permission_denied"); }
  incidentForTenant(session, id) {
    const incident = this.one("SELECT * FROM incidents WHERE tenant_id=? AND id=?", session.active_tenant_id, id);
    if (!incident) throw new ApiError(404, "not_found");
    return incident;
  }

  canReadIncident(session, incident) {
    if (this.permits(session, "incident.read_tenant")) return true;
    if (session.roles.includes("reporter") && incident.created_by === session.user_id) return true;
    return Boolean(session.roles.includes("investigator") && this.one("SELECT 1 FROM incident_assignments WHERE tenant_id=? AND incident_id=? AND investigator_user_id=?", session.active_tenant_id, incident.id, session.user_id));
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/sandbox/")) throw new ApiError(404, "sandbox_route_only");
      const route = url.pathname.slice("/sandbox".length);
      const method = request.method.toUpperCase();
      const body = ["POST", "PATCH", "PUT", "DELETE"].includes(method) ? await this.body(request) : {};

      if (method === "POST" && route === "/auth/login") return this.login(body);
      if (method === "POST" && route === "/auth/recovery/request") return this.requestRecovery(body);
      if (method === "POST" && route === "/auth/recovery/accept") return this.acceptRecovery(body);
      if (method === "POST" && /^\/invitations\/[^/]+\/accept$/.test(route)) return this.acceptInvitation(route.split("/")[2], body);

      const session = this.authenticate(request);
      this.rejectTenantTamper(request, body, session);

      if (method === "POST" && route === "/auth/logout") {
        this.run("UPDATE user_sessions SET revoked_at=? WHERE token_hash=?", nowIso(), session.tokenHash);
        this.securityAudit({ actor: session.user_id, action: "auth.session_revoked", subjectId: session.user_id, changed: ["session_status"] });
        return json(204, {});
      }
      if (method === "POST" && route === "/invitations") return this.createInvitation(session, body);
      if (method === "POST" && /^\/members\/[^/]+\/roles$/.test(route)) return this.grantRole(session, route.split("/")[2], body);
      if (method === "DELETE" && /^\/members\/[^/]+\/roles\/[^/]+$/.test(route)) return this.revokeRole(session, route.split("/")[2], route.split("/")[4]);
      if (method === "PATCH" && /^\/members\/[^/]+\/status$/.test(route)) return this.changeMemberStatus(session, route.split("/")[2], body);
      if (method === "POST" && route === "/roles/site-leader/replace") return this.replaceSiteLeader(session, body);
      if (method === "POST" && route === "/incidents") return this.createIncident(session, body);
      if (method === "GET" && route === "/incidents/search") return this.searchIncidents(session, url.searchParams.get("q") ?? "");
      if (method === "GET" && /^\/incidents\/[^/]+$/.test(route)) return this.readIncident(session, route.split("/")[2]);
      if (method === "PATCH" && /^\/incidents\/[^/]+$/.test(route)) return this.updateIncident(session, route.split("/")[2], body);
      if (method === "DELETE" && /^\/incidents\/[^/]+$/.test(route)) return this.deleteIncident(session, route.split("/")[2]);
      if (method === "POST" && /^\/incidents\/[^/]+\/triage$/.test(route)) return this.triageIncident(session, route.split("/")[2], body);
      if (method === "POST" && /^\/incidents\/[^/]+\/close$/.test(route)) return this.closeIncident(session, route.split("/")[2]);
      if (method === "GET" && /^\/incidents\/[^/]+\/health$/.test(route)) return this.readHealth(session, route.split("/")[2]);
      if (method === "POST" && /^\/incidents\/[^/]+\/export$/.test(route)) return this.exportIncident(session, route.split("/")[2]);
      if (method === "POST" && /^\/incidents\/[^/]+\/attachments\/[^/]+\/sign$/.test(route)) return this.signAttachment(session, route.split("/")[2], route.split("/")[4]);
      if (method === "PATCH" && /^\/corrective-actions\/[^/]+$/.test(route)) return this.updateAction(session, route.split("/")[2], body);
      if (method === "GET" && /^\/audit\/(tenant|security|platform)$/.test(route)) return this.readAudit(session, route.split("/")[2]);
      if (["PATCH", "DELETE"].includes(method) && /^\/audit\/(tenant|security|platform)\/[^/]+$/.test(route)) return this.mutateAudit(route, method);
      throw new ApiError(404, "not_found");
    } catch (error) {
      if (error instanceof ApiError) return json(error.status, { error: error.code });
      if (/audit logs|audit policy/.test(error.message)) return json(409, { error: "audit_immutable" });
      throw error;
    }
  }

  login(body) {
    const email = String(body.email ?? "").toLowerCase();
    if (!email.endsWith(".example.invalid")) throw new ApiError(400, "synthetic_email_required");
    const row = this.one(`SELECT u.id,m.tenant_id FROM users u JOIN tenant_memberships m ON m.user_id=u.id
      WHERE u.email_normalized=? AND u.status='active' AND m.status='active' ORDER BY m.tenant_id LIMIT 1`, email);
    if (!row) throw new ApiError(401, "login_denied");
    return json(200, { token: this.createSession(row.id, row.tenant_id), active_tenant_id: row.tenant_id });
  }

  createInvitation(session, body) {
    this.requireTenant(session);
    if (!session.roles.includes("tenant_admin") && !session.roles.includes("site_leader")) throw new ApiError(403, "permission_denied");
    const email = String(body.email ?? "").toLowerCase();
    const roles = [...new Set(body.roles ?? [])];
    if (!email.endsWith(".example.invalid")) throw new ApiError(400, "synthetic_email_required");
    if (!roles.length || roles.some((role) => !ROLE_RULES[role]?.some((grantor) => session.roles.includes(grantor)))) throw new ApiError(403, "role_grant_denied");
    const invitationId = this.id("invite");
    const challenge = this.token();
    const challengeId = this.id("challenge");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.run("INSERT INTO invitations(id,tenant_id,invited_email_normalized,invited_by_user_id,expires_at) VALUES(?,?,?,?,?)", invitationId, session.active_tenant_id, email, session.user_id, futureIso(body.ttl_seconds ?? 86400));
      for (const role of roles) this.run("INSERT INTO invitation_roles(invitation_id,tenant_id,role) VALUES(?,?,?)", invitationId, session.active_tenant_id, role);
      this.run("INSERT INTO auth_challenges(id,email_normalized,challenge_hash,purpose,invitation_id,expires_at) VALUES(?,?,?,'accept_invite',?,?)", challengeId, email, hash(challenge), invitationId, futureIso(body.challenge_ttl_seconds ?? 86400));
      this.securityAudit({ actor: session.user_id, action: "auth.invite_created", subjectId: invitationId, values: { challenge_purpose: "accept_invite" } });
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    this.mail.send({ to: email, purpose: "accept_invite", invitation_id: invitationId, challenge });
    return json(201, { invitation_id: invitationId, status: "pending" });
  }

  acceptInvitation(invitationId, body) {
    const challengeHash = hash(String(body.challenge ?? ""));
    const invitation = this.one("SELECT * FROM invitations WHERE id=?", invitationId);
    const subjectId = invitationId || "unknown-invitation";
    const challenge = this.one("SELECT * FROM auth_challenges WHERE invitation_id=? AND purpose='accept_invite'", invitationId);
    if (!invitation || !challenge || challenge.challenge_hash !== challengeHash) {
      if (challenge) this.run("UPDATE auth_challenges SET attempt_count=attempt_count+1 WHERE id=?", challenge.id);
      const attempts = challenge ? challenge.attempt_count + 1 : this.maxInviteAttempts;
      this.securityAudit({ action: attempts >= this.maxInviteAttempts ? "auth.rate_limited" : "auth.invite_denied", subjectId, values: { attempt_bucket: attempts >= this.maxInviteAttempts ? "limited" : "retry" }, result: "denied", reason: "invalid_challenge" });
      throw new ApiError(attempts >= this.maxInviteAttempts ? 429 : 401, attempts >= this.maxInviteAttempts ? "rate_limited" : "invite_denied");
    }
    if (challenge.attempt_count >= this.maxInviteAttempts) throw new ApiError(429, "rate_limited");
    if (invitation.status !== "pending" || challenge.consumed_at) throw new ApiError(409, "invite_consumed");
    if (invitation.expires_at <= nowIso() || challenge.expires_at <= nowIso()) throw new ApiError(410, "invite_expired");
    if (String(body.email ?? "").toLowerCase() !== invitation.invited_email_normalized) throw new ApiError(401, "invite_denied");
    const existing = this.one("SELECT id FROM users WHERE email_normalized=?", invitation.invited_email_normalized);
    const userId = existing?.id ?? this.id("user");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (!existing) this.run("INSERT INTO users(id,email_normalized,display_name,status) VALUES(?,?,?,'active')", userId, invitation.invited_email_normalized, "虚构受邀人员");
      else this.run("UPDATE users SET status='active' WHERE id=?", userId);
      this.run("INSERT INTO tenant_memberships(tenant_id,user_id,status) VALUES(?,?,'active') ON CONFLICT(tenant_id,user_id) DO UPDATE SET status='active'", invitation.tenant_id, userId);
      for (const row of this.all("SELECT role FROM invitation_roles WHERE invitation_id=?", invitationId)) this.run("INSERT OR IGNORE INTO tenant_membership_roles(tenant_id,user_id,role,granted_by) VALUES(?,?,?,?)", invitation.tenant_id, userId, row.role, invitation.invited_by_user_id);
      this.run("UPDATE invitations SET status='accepted',accepted_by_user_id=?,accepted_at=? WHERE id=?", userId, nowIso(), invitationId);
      this.run("UPDATE auth_challenges SET consumed_at=? WHERE id=?", nowIso(), challenge.id);
      this.securityAudit({ actor: userId, action: "auth.invite_consumed", subjectId: invitationId, changed: ["challenge_status", "membership_status"], values: { challenge_purpose: "accept_invite", membership_status: "active" } });
      this.tenantAudit({ tenantId: invitation.tenant_id, actor: invitation.invited_by_user_id, action: "membership.status_changed", resourceType: "membership", resourceId: userId, changed: ["membership_status"], values: { membership_status: "active" } });
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return json(200, { token: this.createSession(userId, invitation.tenant_id), active_tenant_id: invitation.tenant_id });
  }

  requestRecovery(body) {
    const email = String(body.email ?? "").toLowerCase();
    if (!email.endsWith(".example.invalid")) throw new ApiError(400, "synthetic_email_required");
    const user = this.one("SELECT id FROM users WHERE email_normalized=? AND status='active'", email);
    if (user) {
      const challenge = this.token();
      this.run("INSERT INTO auth_challenges(id,email_normalized,challenge_hash,purpose,expires_at) VALUES(?,?,?,'recover_account',?)", this.id("challenge"), email, hash(challenge), futureIso(900));
      this.mail.send({ to: email, purpose: "recover_account", challenge });
    }
    this.securityAudit({ action: "auth.recovery_requested", subjectId: opaqueSubject(email), values: { challenge_purpose: "recover_account" } });
    return json(202, { status: "accepted" });
  }

  acceptRecovery(body) {
    const email = String(body.email ?? "").toLowerCase();
    const challenge = this.one("SELECT * FROM auth_challenges WHERE email_normalized=? AND purpose='recover_account' ORDER BY created_at DESC LIMIT 1", email);
    if (!challenge || challenge.challenge_hash !== hash(String(body.challenge ?? "")) || challenge.consumed_at || challenge.expires_at <= nowIso()) throw new ApiError(401, "recovery_denied");
    const user = this.one("SELECT id FROM users WHERE email_normalized=? AND status='active'", email);
    if (!user) throw new ApiError(401, "recovery_denied");
    const membership = this.one("SELECT tenant_id FROM tenant_memberships WHERE user_id=? AND status='active' ORDER BY tenant_id LIMIT 1", user.id);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.run("UPDATE auth_challenges SET consumed_at=? WHERE id=?", nowIso(), challenge.id);
      this.run("UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE user_id=?", nowIso(), user.id);
      this.securityAudit({ actor: user.id, action: "auth.recovery_consumed", subjectId: opaqueSubject(email), changed: ["challenge_status", "session_status"], values: { challenge_purpose: "recover_account" } });
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return json(200, { token: this.createSession(user.id, membership?.tenant_id ?? null), active_tenant_id: membership?.tenant_id ?? null });
  }

  grantRole(session, targetUserId, body) {
    this.requireTenant(session);
    if (targetUserId === session.user_id) throw new ApiError(403, "self_grant_denied");
    const role = body.role;
    if (!ROLE_RULES[role]?.some((grantor) => session.roles.includes(grantor))) throw new ApiError(403, "role_grant_denied");
    this.run("INSERT INTO tenant_membership_roles(tenant_id,user_id,role,granted_by) VALUES(?,?,?,?)", session.active_tenant_id, targetUserId, role, session.user_id);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "membership.role_changed", resourceType: "membership", resourceId: targetUserId, changed: ["role"], values: { role } });
    return json(201, { role });
  }

  revokeRole(session, targetUserId, role) {
    this.requireTenant(session);
    if (role === "site_leader") {
      const count = this.one(`SELECT COUNT(*) AS count FROM tenant_membership_roles r JOIN tenant_memberships m ON m.tenant_id=r.tenant_id AND m.user_id=r.user_id
        WHERE r.tenant_id=? AND r.role='site_leader' AND m.status='active'`, session.active_tenant_id).count;
      if (count <= 1) throw new ApiError(409, "last_site_leader_protected");
      throw new ApiError(403, "special_flow_required");
    }
    if (!ROLE_RULES[role]?.some((grantor) => session.roles.includes(grantor))) throw new ApiError(403, "role_revoke_denied");
    this.run("DELETE FROM tenant_membership_roles WHERE tenant_id=? AND user_id=? AND role=?", session.active_tenant_id, targetUserId, role);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "membership.role_changed", resourceType: "membership", resourceId: targetUserId, changed: ["role"], values: { role } });
    return json(200, { revoked: role });
  }

  changeMemberStatus(session, targetUserId, body) {
    this.requireTenant(session);
    if (!session.roles.includes("tenant_admin")) throw new ApiError(403, "permission_denied");
    const status = body.status;
    if (!new Set(["active", "disabled"]).has(status)) throw new ApiError(400, "invalid_membership_status");
    const member = this.one("SELECT status FROM tenant_memberships WHERE tenant_id=? AND user_id=?", session.active_tenant_id, targetUserId);
    if (!member) throw new ApiError(404, "not_found");
    if (status === "disabled" && this.one("SELECT 1 FROM tenant_membership_roles WHERE tenant_id=? AND user_id=? AND role='site_leader'", session.active_tenant_id, targetUserId)) {
      const leaders = this.one(`SELECT COUNT(*) AS count FROM tenant_membership_roles r JOIN tenant_memberships m ON m.tenant_id=r.tenant_id AND m.user_id=r.user_id
        WHERE r.tenant_id=? AND r.role='site_leader' AND m.status='active'`, session.active_tenant_id).count;
      if (leaders <= 1) throw new ApiError(409, "last_site_leader_protected");
    }
    this.run("UPDATE tenant_memberships SET status=? WHERE tenant_id=? AND user_id=?", status, session.active_tenant_id, targetUserId);
    if (status === "disabled") this.run("UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE active_tenant_id=? AND user_id=?", nowIso(), session.active_tenant_id, targetUserId);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "membership.status_changed", resourceType: "membership", resourceId: targetUserId, changed: ["membership_status"], values: { membership_status: status } });
    return json(200, { user_id: targetUserId, status });
  }

  replaceSiteLeader(session, body) {
    this.requireTenant(session);
    if (!session.roles.includes("site_leader")) throw new ApiError(403, "permission_denied");
    if (body.target_user_id === session.user_id) throw new ApiError(403, "self_grant_denied");
    if (body.step_up_confirmation !== "CONFIRM_SITE_LEADER_REPLACEMENT") throw new ApiError(403, "step_up_required");
    const target = this.one("SELECT status FROM tenant_memberships WHERE tenant_id=? AND user_id=?", session.active_tenant_id, body.target_user_id);
    if (!target || target.status !== "active") throw new ApiError(404, "active_member_required");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.run("INSERT OR IGNORE INTO tenant_membership_roles(tenant_id,user_id,role,granted_by) VALUES(?,?,\'site_leader\',?)", session.active_tenant_id, body.target_user_id, session.user_id);
      this.run("DELETE FROM tenant_membership_roles WHERE tenant_id=? AND user_id=? AND role='site_leader'", session.active_tenant_id, session.user_id);
      this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "membership.role_changed", resourceType: "membership", resourceId: body.target_user_id, changed: ["role"], values: { role: "site_leader" } });
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
    return json(200, { site_leader_user_id: body.target_user_id });
  }

  createIncident(session, body) {
    this.requireTenant(session); this.requirePermission(session, "incident.create");
    const id = this.id("incident");
    this.run(`INSERT INTO incidents(id,tenant_id,reference_no,title,occurred_at,category,created_by)
      VALUES(?,?,?,?,?,?,?)`, id, session.active_tenant_id, body.reference_no ?? this.id("REF"), String(body.title ?? "虚构事件"), body.occurred_at ?? nowIso(), body.category ?? "near_miss", session.user_id);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "incident.created", resourceType: "incident", resourceId: id });
    return json(201, { id, tenant_id: session.active_tenant_id, status: "reported" });
  }

  readIncident(session, id) {
    this.requireTenant(session); const incident = this.incidentForTenant(session, id);
    if (!this.canReadIncident(session, incident)) throw new ApiError(403, "permission_denied");
    return json(200, incident);
  }

  searchIncidents(session, query) {
    this.requireTenant(session);
    const rows = this.all("SELECT * FROM incidents WHERE tenant_id=? AND title LIKE ? ORDER BY created_at", session.active_tenant_id, `%${query}%`).filter((row) => this.canReadIncident(session, row));
    return json(200, { items: rows });
  }

  updateIncident(session, id, body) {
    this.requireTenant(session); const incident = this.incidentForTenant(session, id);
    const ownDraft = session.roles.includes("reporter") && incident.created_by === session.user_id && incident.status === "reported";
    if (!ownDraft && !this.permits(session, "incident.read_tenant")) throw new ApiError(403, "permission_denied");
    this.run("UPDATE incidents SET title=?,updated_at=? WHERE tenant_id=? AND id=?", String(body.title ?? incident.title), nowIso(), session.active_tenant_id, id);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "incident.fields_changed", resourceType: "incident", resourceId: id, changed: ["title"] });
    return json(200, { id, title: String(body.title ?? incident.title) });
  }

  deleteIncident(session, id) {
    this.requireTenant(session); this.incidentForTenant(session, id); this.requirePermission(session, "incident.delete");
    this.run("DELETE FROM incidents WHERE tenant_id=? AND id=?", session.active_tenant_id, id);
    return json(204, {});
  }

  triageIncident(session, id, body) {
    this.requireTenant(session); this.incidentForTenant(session, id); this.requirePermission(session, "incident.triage");
    this.run("UPDATE incidents SET actual_consequence=?,potential_consequence=?,investigation_level=?,status='triaged',updated_at=? WHERE tenant_id=? AND id=?", body.actual_consequence ?? "low", body.potential_consequence ?? "medium", body.investigation_level ?? "basic", nowIso(), session.active_tenant_id, id);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "incident.status_changed", resourceType: "incident", resourceId: id, changed: ["actual_consequence", "potential_consequence", "investigation_level", "status"], values: { status: "triaged", actual_consequence: body.actual_consequence ?? "low", potential_consequence: body.potential_consequence ?? "medium", investigation_level: body.investigation_level ?? "basic" } });
    return json(200, { id, status: "triaged" });
  }

  closeIncident(session, id) {
    this.requireTenant(session); this.incidentForTenant(session, id); this.requirePermission(session, "incident.close");
    this.run("UPDATE incidents SET status='closed',updated_at=? WHERE tenant_id=? AND id=?", nowIso(), session.active_tenant_id, id);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "incident.closed", resourceType: "incident", resourceId: id, changed: ["status"], values: { status: "closed" } });
    return json(200, { id, status: "closed" });
  }

  readHealth(session, id) {
    this.requireTenant(session); this.incidentForTenant(session, id); this.requirePermission(session, "health.read");
    if (session.roles.includes("investigator") && !this.one("SELECT 1 FROM incident_assignments WHERE tenant_id=? AND incident_id=? AND investigator_user_id=?", session.active_tenant_id, id, session.user_id)) throw new ApiError(403, "permission_denied");
    const rows = this.all("SELECT id,encrypted_identity,encrypted_health_details FROM incident_persons WHERE tenant_id=? AND incident_id=?", session.active_tenant_id, id);
    return json(200, { items: rows });
  }

  exportIncident(session, id) {
    this.requireTenant(session); this.incidentForTenant(session, id); this.requirePermission(session, "export.create");
    const exportId = this.id("export");
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "export.requested", resourceType: "incident", resourceId: id });
    return json(202, { export_id: exportId, sandbox: true, object_created: false });
  }

  signAttachment(session, incidentId, attachmentId) {
    this.requireTenant(session); const incident = this.incidentForTenant(session, incidentId);
    if (!this.canReadIncident(session, incident)) throw new ApiError(403, "permission_denied");
    return json(200, { attachment_id: attachmentId, signed_url: `sandbox://attachment/${encodeURIComponent(attachmentId)}`, expires_in: 60, r2_object_created: false });
  }

  updateAction(session, id, body) {
    this.requireTenant(session);
    const action = this.one("SELECT * FROM corrective_actions WHERE tenant_id=? AND id=?", session.active_tenant_id, id);
    if (!action) throw new ApiError(404, "not_found");
    if (action.owner_user_id !== session.user_id) throw new ApiError(403, "permission_denied");
    const status = body.status ?? "in_progress";
    this.run("UPDATE corrective_actions SET status=? WHERE tenant_id=? AND id=?", status, session.active_tenant_id, id);
    this.tenantAudit({ tenantId: session.active_tenant_id, actor: session.user_id, action: "corrective_action.status_changed", resourceType: "corrective_action", resourceId: id, changed: ["status"], values: { status } });
    return json(200, { id, status });
  }

  readAudit(session, domain) {
    if (domain === "tenant") { this.requireTenant(session); this.requirePermission(session, "audit.read"); return json(200, { items: this.all("SELECT * FROM tenant_audit_logs WHERE tenant_id=?", session.active_tenant_id) }); }
    if (domain === "security" && session.platformAdmin) return json(200, { items: this.all("SELECT * FROM security_audit_logs ORDER BY created_at") });
    if (domain === "platform" && session.platformAdmin) return json(200, { items: this.all("SELECT * FROM platform_audit_logs ORDER BY created_at") });
    throw new ApiError(403, "audit_domain_denied");
  }

  mutateAudit(route, method) {
    const [, , domain, id] = route.split("/");
    const table = `${domain}_audit_logs`;
    if (!new Set(["tenant_audit_logs", "security_audit_logs", "platform_audit_logs"]).has(table)) throw new ApiError(404, "not_found");
    if (method === "PATCH") this.run(`UPDATE ${table} SET result='failed' WHERE id=?`, id);
    else this.run(`DELETE FROM ${table} WHERE id=?`, id);
    return json(204, {});
  }
}

export function createRequest(path, { method = "GET", token, body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (token) requestHeaders.set("authorization", `Bearer ${token}`);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  return new Request(`http://sandbox.local${path}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
}
