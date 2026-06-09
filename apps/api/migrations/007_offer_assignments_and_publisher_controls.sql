ALTER TABLE publishers
  ADD COLUMN IF NOT EXISTS publisher_tier TEXT NOT NULL DEFAULT 'tier_1'
    CHECK (publisher_tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
  ADD COLUMN IF NOT EXISTS publisher_postback_percent INTEGER NOT NULL DEFAULT 100
    CHECK (publisher_postback_percent BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS organization_publisher_tier_settings (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
  payout_percent INTEGER NOT NULL CHECK (payout_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, tier)
);

INSERT INTO organization_publisher_tier_settings (organization_id, tier, payout_percent)
SELECT id, 'tier_1', 40
FROM organizations
ON CONFLICT (organization_id, tier) DO NOTHING;

INSERT INTO organization_publisher_tier_settings (organization_id, tier, payout_percent)
SELECT id, 'tier_2', 55
FROM organizations
ON CONFLICT (organization_id, tier) DO NOTHING;

INSERT INTO organization_publisher_tier_settings (organization_id, tier, payout_percent)
SELECT id, 'tier_3', 70
FROM organizations
ON CONFLICT (organization_id, tier) DO NOTHING;

INSERT INTO organization_publisher_tier_settings (organization_id, tier, payout_percent)
SELECT id, 'tier_4', 80
FROM organizations
ON CONFLICT (organization_id, tier) DO NOTHING;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS viewer_membership_id TEXT NULL REFERENCES memberships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS offers_organization_viewer_membership_status_idx
  ON offers (organization_id, viewer_membership_id, status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS offer_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  publisher_id TEXT NOT NULL REFERENCES publishers(id) ON DELETE RESTRICT,
  tracking_token TEXT NOT NULL UNIQUE,
  conversion_visibility_percent INTEGER NOT NULL DEFAULT 100
    CHECK (conversion_visibility_percent BETWEEN 0 AND 100),
  postback_percent INTEGER NOT NULL DEFAULT 100
    CHECK (postback_percent BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')) DEFAULT 'active',
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_assignment_payout_overrides (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  offer_assignment_id TEXT NOT NULL REFERENCES offer_assignments(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  publisher_payout_amount NUMERIC(12, 2) NOT NULL CHECK (publisher_payout_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (offer_assignment_id, event_code)
);

CREATE INDEX IF NOT EXISTS organization_publisher_tier_settings_org_idx
  ON organization_publisher_tier_settings (organization_id, tier);

CREATE INDEX IF NOT EXISTS offer_assignments_organization_status_created_idx
  ON offer_assignments (organization_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS offer_assignments_organization_offer_publisher_status_idx
  ON offer_assignments (organization_id, offer_id, publisher_id, status);

CREATE INDEX IF NOT EXISTS offer_assignments_offer_idx
  ON offer_assignments (offer_id);

CREATE INDEX IF NOT EXISTS offer_assignments_publisher_idx
  ON offer_assignments (publisher_id);

CREATE INDEX IF NOT EXISTS offer_assignment_payout_overrides_assignment_event_code_idx
  ON offer_assignment_payout_overrides (offer_assignment_id, event_code);
