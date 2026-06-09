CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  website_url TEXT NULL,
  primary_contact_name TEXT NULL,
  primary_contact_email TEXT NULL,
  notes TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS publishers_organization_status_created_idx
  ON publishers (organization_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS publishers_organization_normalized_name_status_idx
  ON publishers (organization_id, normalized_name, status);
