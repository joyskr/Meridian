CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'exported', 'reconciled')),
  approved_at TIMESTAMPTZ NULL,
  exported_at TIMESTAMPTZ NULL,
  reconciled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payout_batches_organization_status_created_idx
  ON payout_batches (organization_id, status, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  conversion_id TEXT NOT NULL UNIQUE REFERENCES conversions(id) ON DELETE RESTRICT,
  click_id TEXT NOT NULL REFERENCES clicks(id) ON DELETE RESTRICT,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  offer_assignment_id TEXT NOT NULL REFERENCES offer_assignments(id) ON DELETE RESTRICT,
  publisher_id TEXT NOT NULL REFERENCES publishers(id) ON DELETE RESTRICT,
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  source_surface TEXT NOT NULL CHECK (source_surface IN ('ingest', 'gpixel', 'goal')),
  finalized_at TIMESTAMPTZ NOT NULL,
  advertiser_payout NUMERIC(12, 2) NOT NULL CHECK (advertiser_payout >= 0),
  publisher_payout NUMERIC(12, 2) NOT NULL CHECK (publisher_payout >= 0),
  publisher_payout_source TEXT NOT NULL CHECK (publisher_payout_source IN ('assignment_override', 'publisher_tier')),
  publisher_tier TEXT NOT NULL CHECK (publisher_tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
  publisher_tier_percent INTEGER NOT NULL CHECK (publisher_tier_percent BETWEEN 0 AND 100),
  assignment_override_amount NUMERIC(12, 2) NULL CHECK (assignment_override_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payouts_batch_created_idx
  ON payouts (batch_id, created_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS payouts_organization_created_idx
  ON payouts (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS payouts_publisher_idx
  ON payouts (publisher_id, created_at DESC, id DESC);
