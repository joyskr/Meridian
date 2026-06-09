ALTER TABLE offer_assignments
  ADD COLUMN IF NOT EXISTS redirect_url TEXT NULL;

CREATE TABLE IF NOT EXISTS clicks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  offer_assignment_id TEXT NOT NULL REFERENCES offer_assignments(id) ON DELETE RESTRICT,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  publisher_id TEXT NOT NULL REFERENCES publishers(id) ON DELETE RESTRICT,
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  tracking_token_hash TEXT NOT NULL,
  tracking_resolution_status TEXT NOT NULL CHECK (tracking_resolution_status IN ('accepted')),
  resolved_redirect_url TEXT NOT NULL,
  request_query TEXT NULL,
  request_ip TEXT NULL,
  request_user_agent TEXT NULL,
  request_referer TEXT NULL,
  request_id TEXT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clicks_organization_clicked_at_idx
  ON clicks (organization_id, clicked_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS clicks_assignment_clicked_at_idx
  ON clicks (offer_assignment_id, clicked_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS clicks_offer_clicked_at_idx
  ON clicks (offer_id, clicked_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS clicks_publisher_clicked_at_idx
  ON clicks (publisher_id, clicked_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS clicks_advertiser_clicked_at_idx
  ON clicks (advertiser_id, clicked_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS clicks_tracking_token_hash_idx
  ON clicks (tracking_token_hash);
