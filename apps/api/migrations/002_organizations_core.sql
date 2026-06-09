CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'analyst', 'viewer')),
  status TEXT NOT NULL CHECK (status IN ('active', 'deactivated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE sessions
  ADD COLUMN active_organization_id TEXT NULL REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS memberships_user_status_idx
  ON memberships (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS memberships_organization_status_idx
  ON memberships (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS sessions_active_organization_idx
  ON sessions (active_organization_id);
