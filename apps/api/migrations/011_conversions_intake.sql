CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  offer_assignment_id TEXT NULL REFERENCES offer_assignments(id) ON DELETE RESTRICT,
  click_id TEXT NULL REFERENCES clicks(id) ON DELETE RESTRICT,
  offer_id TEXT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  publisher_id TEXT NULL REFERENCES publishers(id) ON DELETE RESTRICT,
  source_surface TEXT NOT NULL CHECK (source_surface IN ('ingest', 'gpixel', 'goal')),
  event_type TEXT NOT NULL,
  external_event_id TEXT NULL,
  idempotency_key TEXT NULL,
  lookup_click_id TEXT NULL,
  lookup_sub1 TEXT NULL,
  lookup_sub2 TEXT NULL,
  lookup_sub3 TEXT NULL,
  lookup_sub4 TEXT NULL,
  lookup_sub5 TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'finalized', 'rejected')),
  rejection_reason TEXT NULL,
  occurred_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversions_organization_received_idx
  ON conversions (organization_id, received_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS conversions_advertiser_status_received_idx
  ON conversions (advertiser_id, status, received_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS conversions_click_idx
  ON conversions (click_id);

CREATE INDEX IF NOT EXISTS conversions_offer_idx
  ON conversions (offer_id);

CREATE INDEX IF NOT EXISTS conversions_publisher_idx
  ON conversions (publisher_id);

CREATE INDEX IF NOT EXISTS conversions_offer_assignment_idx
  ON conversions (offer_assignment_id);

CREATE INDEX IF NOT EXISTS conversions_external_event_idx
  ON conversions (advertiser_id, external_event_id);

CREATE INDEX IF NOT EXISTS conversions_idempotency_key_idx
  ON conversions (advertiser_id, idempotency_key);
