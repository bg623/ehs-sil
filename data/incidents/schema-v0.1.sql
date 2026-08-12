-- EHS-SIL Incident / LFI schema contract V0.2 (Stage 1.5 security gate)
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

CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('sign_in', 'accept_invite', 'recover_account')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE audit_logs (
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

CREATE INDEX idx_audit_scope ON audit_logs(tenant_id, resource_type, resource_id, created_at);

CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit logs are append-only');
END;

CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit logs cannot be deleted');
END;
