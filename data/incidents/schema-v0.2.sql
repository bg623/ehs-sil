-- EHS-SIL Incident / LFI schema contract V0.2 (Stage 1.5.1 contract correction)
-- This file is design/test input only, not a production migration.
-- Real data intake remains disabled until server-side RBAC and isolation tests pass.

PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  tenancy_model TEXT NOT NULL DEFAULT 'single_site_pilot'
    CHECK (tenancy_model = 'single_site_pilot'),
  status TEXT NOT NULL DEFAULT 'pilot' CHECK (status IN ('pilot', 'active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tenant_memberships (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- A user can hold multiple tenant-scoped roles. Roles do not inherit implicitly;
-- effective permissions are the union of explicit active roles, subject to
-- resource ownership and field-level restrictions enforced by the API.
CREATE TABLE tenant_membership_roles (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('reporter', 'investigator', 'ehs_manager', 'site_leader', 'tenant_admin')),
  granted_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, user_id, role),
  FOREIGN KEY (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id),
  FOREIGN KEY (tenant_id, granted_by) REFERENCES tenant_memberships(tenant_id, user_id)
);

-- Platform administration is deliberately outside tenant RBAC. This table
-- grants platform operations only and never grants tenant business-data read.
CREATE TABLE platform_administrators (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Time-limited, approved break-glass access is the only path by which a
-- platform administrator may support a tenant. It must be independently audited.
CREATE TABLE platform_support_grants (
  id TEXT PRIMARY KEY,
  platform_user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  approved_by_tenant_user_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (platform_user_id) REFERENCES platform_administrators(user_id),
  FOREIGN KEY (tenant_id, approved_by_tenant_user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invited_email_normalized TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  accepted_by_user_id TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, invited_by_user_id) REFERENCES tenant_memberships(tenant_id, user_id),
  FOREIGN KEY (accepted_by_user_id) REFERENCES users(id)
);

CREATE INDEX idx_invitations_email_status
  ON invitations(invited_email_normalized, status, expires_at);

CREATE TABLE invitation_roles (
  invitation_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('reporter', 'investigator', 'ehs_manager', 'site_leader', 'tenant_admin')),
  PRIMARY KEY (invitation_id, role),
  FOREIGN KEY (tenant_id, invitation_id) REFERENCES invitations(tenant_id, id)
);

-- This one-time record supports the initial site_leader only. The opening flow
-- must consume it in the same transaction that activates the membership and
-- grants site_leader. Later site_leader changes use step-up confirmation.
CREATE TABLE tenant_bootstrap_grants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  invited_email_normalized TEXT NOT NULL,
  grant_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('sign_in', 'accept_invite', 'recover_account')),
  invitation_id TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (purpose = 'accept_invite' AND invitation_id IS NOT NULL) OR
    (purpose <> 'accept_invite' AND invitation_id IS NULL)
  ),
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);

CREATE INDEX idx_auth_challenges_expiry ON auth_challenges(expires_at, consumed_at);

CREATE TABLE user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  active_tenant_id TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (active_tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE INDEX idx_user_sessions_expiry ON user_sessions(expires_at, revoked_at);

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reference_no TEXT NOT NULL,
  title TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  category TEXT NOT NULL,
  actual_consequence TEXT,
  potential_consequence TEXT,
  investigation_level TEXT,
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'triaged', 'investigating', 'actions_open', 'verification', 'closed')),
  confidentiality TEXT NOT NULL DEFAULT 'normal' CHECK (confidentiality IN ('normal', 'confidential', 'anonymous')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, reference_no),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, created_by) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE INDEX idx_incidents_tenant_status ON incidents(tenant_id, status, occurred_at);

CREATE TABLE incident_assignments (
  tenant_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  investigator_user_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, incident_id, investigator_user_id),
  FOREIGN KEY (tenant_id, incident_id) REFERENCES incidents(tenant_id, id),
  FOREIGN KEY (tenant_id, investigator_user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE TABLE incident_persons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  encrypted_identity TEXT,
  encrypted_health_details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, incident_id) REFERENCES incidents(tenant_id, id)
);

CREATE INDEX idx_incident_persons_scope ON incident_persons(tenant_id, incident_id);

CREATE TABLE regulatory_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  reminder_status TEXT NOT NULL CHECK (reminder_status IN ('needs_review', 'possibly_reportable', 'not_reportable_confirmed', 'reported')),
  decision_reason TEXT,
  decided_by TEXT,
  reported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, incident_id) REFERENCES incidents(tenant_id, id),
  FOREIGN KEY (tenant_id, decided_by) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE TABLE investigations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  lead_user_id TEXT,
  method TEXT,
  facts TEXT,
  conclusion TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, incident_id) REFERENCES incidents(tenant_id, id),
  FOREIGN KEY (tenant_id, lead_user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE TABLE corrective_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  owner_user_id TEXT,
  action_text TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_verification', 'verified', 'rejected')),
  effectiveness_result TEXT,
  verified_by TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, incident_id) REFERENCES incidents(tenant_id, id),
  FOREIGN KEY (tenant_id, owner_user_id) REFERENCES tenant_memberships(tenant_id, user_id),
  FOREIGN KEY (tenant_id, verified_by) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE INDEX idx_actions_tenant_status ON corrective_actions(tenant_id, status, due_at);

CREATE TABLE lfi_notices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  title TEXT NOT NULL,
  learning_summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published', 'retired')),
  approved_by TEXT,
  published_at TEXT,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, incident_id) REFERENCES incidents(tenant_id, id),
  FOREIGN KEY (tenant_id, approved_by) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE TABLE rollout_checks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lfi_notice_id TEXT NOT NULL,
  scope_name TEXT NOT NULL,
  owner_user_id TEXT,
  result TEXT,
  verified_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, lfi_notice_id) REFERENCES lfi_notices(tenant_id, id),
  FOREIGN KEY (tenant_id, owner_user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

-- Audit event policies are enforced by BEFORE INSERT triggers. They are not
-- application hints: an unlisted event is rejected at the storage boundary.
CREATE TABLE audit_event_policies (
  domain TEXT NOT NULL CHECK (domain IN ('tenant', 'security', 'platform')),
  event_name TEXT NOT NULL,
  PRIMARY KEY (domain, event_name)
);

INSERT INTO audit_event_policies(domain, event_name) VALUES
  ('tenant', 'membership.role_changed'),
  ('tenant', 'membership.status_changed'),
  ('tenant', 'incident.created'),
  ('tenant', 'incident.fields_changed'),
  ('tenant', 'incident.status_changed'),
  ('tenant', 'incident.closed'),
  ('tenant', 'regulatory_report.status_changed'),
  ('tenant', 'investigation.status_changed'),
  ('tenant', 'corrective_action.assigned'),
  ('tenant', 'corrective_action.status_changed'),
  ('tenant', 'corrective_action.verified'),
  ('tenant', 'lfi.status_changed'),
  ('tenant', 'rollout.status_changed'),
  ('tenant', 'export.requested'),
  ('tenant', 'export.completed'),
  ('tenant', 'export.denied'),
  ('security', 'auth.invite_created'),
  ('security', 'auth.invite_consumed'),
  ('security', 'auth.invite_denied'),
  ('security', 'auth.recovery_requested'),
  ('security', 'auth.recovery_consumed'),
  ('security', 'auth.session_revoked'),
  ('security', 'auth.access_denied'),
  ('security', 'auth.rate_limited'),
  ('platform', 'platform.deployment_changed'),
  ('platform', 'platform.support_grant_created'),
  ('platform', 'platform.support_accessed'),
  ('platform', 'platform.support_grant_revoked'),
  ('platform', 'platform.break_glass_denied');

CREATE TRIGGER audit_event_policies_no_update
BEFORE UPDATE ON audit_event_policies BEGIN
  SELECT RAISE(ABORT, 'audit policy is immutable');
END;
CREATE TRIGGER audit_event_policies_no_delete
BEFORE DELETE ON audit_event_policies BEGIN
  SELECT RAISE(ABORT, 'audit policy cannot be deleted');
END;

CREATE TABLE tenant_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  allowed_values_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('allowed', 'denied', 'failed')),
  reason_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (tenant_id, actor_user_id) REFERENCES tenant_memberships(tenant_id, user_id)
);

CREATE INDEX idx_tenant_audit_scope
  ON tenant_audit_logs(tenant_id, resource_type, resource_id, created_at);

CREATE TABLE security_audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  allowed_values_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('allowed', 'denied', 'failed')),
  reason_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX idx_security_audit_subject
  ON security_audit_logs(subject_id, created_at);

CREATE TABLE platform_audit_logs (
  id TEXT PRIMARY KEY,
  platform_actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  tenant_reference_id TEXT,
  changed_fields_json TEXT NOT NULL DEFAULT '[]',
  allowed_values_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('allowed', 'denied', 'failed')),
  reason_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (platform_actor_user_id) REFERENCES platform_administrators(user_id),
  FOREIGN KEY (tenant_reference_id) REFERENCES tenants(id)
);

CREATE INDEX idx_platform_audit_resource
  ON platform_audit_logs(resource_type, resource_id, created_at);

-- Each write is checked against the event allowlist and a strict JSON shape.
-- Free text and complete before/after payloads have no storage column.
CREATE TRIGGER tenant_audit_logs_validate
BEFORE INSERT ON tenant_audit_logs BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM audit_event_policies WHERE domain = 'tenant' AND event_name = NEW.action
  ) THEN RAISE(ABORT, 'tenant audit event is not allowlisted') END;
  SELECT CASE WHEN json_valid(NEW.changed_fields_json) = 0 OR json_type(NEW.changed_fields_json) <> 'array'
    THEN RAISE(ABORT, 'changed fields must be a JSON array') END;
  SELECT CASE WHEN json_valid(NEW.allowed_values_json) = 0 OR json_type(NEW.allowed_values_json) <> 'object'
    THEN RAISE(ABORT, 'allowed values must be a JSON object') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.changed_fields_json)
    WHERE type <> 'text' OR value NOT IN (
      'title','occurred_at','category','actual_consequence','potential_consequence',
      'investigation_level','status','confidentiality','reminder_status','role',
      'membership_status','owner_user_id','due_at','effectiveness_result'
    )
  ) THEN RAISE(ABORT, 'tenant changed field is not allowlisted') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_values_json)
    WHERE key NOT IN ('status','actual_consequence','potential_consequence','investigation_level','confidentiality','reminder_status','role','membership_status')
  ) THEN RAISE(ABORT, 'tenant audit field is not allowlisted') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_values_json)
    WHERE type NOT IN ('text','integer','real','null','true','false') OR length(CAST(value AS TEXT)) > 80
  ) THEN RAISE(ABORT, 'tenant audit value must be a short scalar') END;
END;

CREATE TRIGGER security_audit_logs_validate
BEFORE INSERT ON security_audit_logs BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM audit_event_policies WHERE domain = 'security' AND event_name = NEW.action
  ) THEN RAISE(ABORT, 'security audit event is not allowlisted') END;
  SELECT CASE WHEN json_valid(NEW.changed_fields_json) = 0 OR json_type(NEW.changed_fields_json) <> 'array'
    THEN RAISE(ABORT, 'changed fields must be a JSON array') END;
  SELECT CASE WHEN json_valid(NEW.allowed_values_json) = 0 OR json_type(NEW.allowed_values_json) <> 'object'
    THEN RAISE(ABORT, 'allowed values must be a JSON object') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.changed_fields_json)
    WHERE type <> 'text' OR value NOT IN ('challenge_status','membership_status','session_status','attempt_bucket')
  ) THEN RAISE(ABORT, 'security changed field is not allowlisted') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_values_json)
    WHERE key NOT IN ('challenge_purpose','membership_status','attempt_bucket')
  ) THEN RAISE(ABORT, 'security audit field is not allowlisted') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_values_json)
    WHERE type NOT IN ('text','integer','real','null','true','false') OR length(CAST(value AS TEXT)) > 80
  ) THEN RAISE(ABORT, 'security audit value must be a short scalar') END;
END;

CREATE TRIGGER platform_audit_logs_validate
BEFORE INSERT ON platform_audit_logs BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM audit_event_policies WHERE domain = 'platform' AND event_name = NEW.action
  ) THEN RAISE(ABORT, 'platform audit event is not allowlisted') END;
  SELECT CASE WHEN json_valid(NEW.changed_fields_json) = 0 OR json_type(NEW.changed_fields_json) <> 'array'
    THEN RAISE(ABORT, 'changed fields must be a JSON array') END;
  SELECT CASE WHEN json_valid(NEW.allowed_values_json) = 0 OR json_type(NEW.allowed_values_json) <> 'object'
    THEN RAISE(ABORT, 'allowed values must be a JSON object') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.changed_fields_json)
    WHERE type <> 'text' OR value NOT IN ('deployment_status','support_grant_status','break_glass_result','expires_at','revoked_at')
  ) THEN RAISE(ABORT, 'platform changed field is not allowlisted') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_values_json)
    WHERE key NOT IN ('deployment_status','support_grant_status','break_glass_result')
  ) THEN RAISE(ABORT, 'platform audit field is not allowlisted') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.allowed_values_json)
    WHERE type NOT IN ('text','integer','real','null','true','false') OR length(CAST(value AS TEXT)) > 80
  ) THEN RAISE(ABORT, 'platform audit value must be a short scalar') END;
END;

CREATE TRIGGER tenant_audit_logs_no_update BEFORE UPDATE ON tenant_audit_logs BEGIN SELECT RAISE(ABORT, 'tenant audit logs are append-only'); END;
CREATE TRIGGER tenant_audit_logs_no_delete BEFORE DELETE ON tenant_audit_logs BEGIN SELECT RAISE(ABORT, 'tenant audit logs cannot be deleted'); END;
CREATE TRIGGER security_audit_logs_no_update BEFORE UPDATE ON security_audit_logs BEGIN SELECT RAISE(ABORT, 'security audit logs are append-only'); END;
CREATE TRIGGER security_audit_logs_no_delete BEFORE DELETE ON security_audit_logs BEGIN SELECT RAISE(ABORT, 'security audit logs cannot be deleted'); END;
CREATE TRIGGER platform_audit_logs_no_update BEFORE UPDATE ON platform_audit_logs BEGIN SELECT RAISE(ABORT, 'platform audit logs are append-only'); END;
CREATE TRIGGER platform_audit_logs_no_delete BEFORE DELETE ON platform_audit_logs BEGIN SELECT RAISE(ABORT, 'platform audit logs cannot be deleted'); END;
