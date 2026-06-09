CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  description TEXT NULL,
  tracking_slug TEXT NULL,
  terms TEXT NULL,
  start_at TIMESTAMPTZ NULL,
  end_at TIMESTAMPTZ NULL,
  daily_cap INTEGER NULL,
  monthly_cap INTEGER NULL,
  overall_cap INTEGER NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offer_event_definitions (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  event_name TEXT NOT NULL,
  advertiser_payout NUMERIC(12, 2) NOT NULL CHECK (advertiser_payout >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (offer_id, event_code)
);

CREATE INDEX IF NOT EXISTS offers_organization_status_created_idx
  ON offers (organization_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS offers_organization_advertiser_normalized_name_status_idx
  ON offers (organization_id, advertiser_id, normalized_name, status);

CREATE INDEX IF NOT EXISTS offers_organization_advertiser_status_created_idx
  ON offers (organization_id, advertiser_id, status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS offer_event_definitions_offer_event_code_idx
  ON offer_event_definitions (offer_id, event_code);
