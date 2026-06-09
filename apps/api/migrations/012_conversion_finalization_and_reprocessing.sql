ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS advertiser_payout NUMERIC(12, 2) NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS publisher_payout NUMERIC(12, 2) NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS publisher_payout_source TEXT NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS publisher_tier TEXT NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS publisher_tier_percent INTEGER NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS assignment_override_amount NUMERIC(12, 2) NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS conversion_visibility_percent INTEGER NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS conversion_visible_to_publisher BOOLEAN NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS publisher_postback_percent INTEGER NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS assignment_postback_percent INTEGER NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS effective_postback_percent INTEGER NULL;

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS postback_eligible BOOLEAN NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_organization_created_idx
  ON audit_logs (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON audit_logs (entity_type, entity_id, created_at DESC, id DESC);
