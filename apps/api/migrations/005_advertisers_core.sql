CREATE TABLE IF NOT EXISTS advertisers (
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

CREATE INDEX IF NOT EXISTS advertisers_organization_status_created_idx
  ON advertisers (organization_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS advertisers_organization_normalized_name_status_idx
  ON advertisers (organization_id, normalized_name, status);
