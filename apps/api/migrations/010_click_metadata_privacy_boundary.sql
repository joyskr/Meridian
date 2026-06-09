CREATE TABLE clicks_privacy_boundary (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  offer_assignment_id TEXT NOT NULL REFERENCES offer_assignments(id) ON DELETE RESTRICT,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  publisher_id TEXT NOT NULL REFERENCES publishers(id) ON DELETE RESTRICT,
  advertiser_id TEXT NOT NULL REFERENCES advertisers(id) ON DELETE RESTRICT,
  tracking_token_hash TEXT NOT NULL,
  tracking_resolution_status TEXT NOT NULL CHECK (tracking_resolution_status IN ('accepted')),
  resolved_redirect_url TEXT NOT NULL,
  request_ip_hash TEXT NULL,
  attribution_sub1 TEXT NULL,
  attribution_sub2 TEXT NULL,
  attribution_sub3 TEXT NULL,
  attribution_sub4 TEXT NULL,
  attribution_sub5 TEXT NULL,
  attribution_utm_source TEXT NULL,
  attribution_utm_medium TEXT NULL,
  attribution_utm_campaign TEXT NULL,
  attribution_utm_content TEXT NULL,
  attribution_utm_term TEXT NULL,
  request_user_agent TEXT NULL,
  request_referer TEXT NULL,
  request_id TEXT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO clicks_privacy_boundary (
  id,
  organization_id,
  offer_assignment_id,
  offer_id,
  publisher_id,
  advertiser_id,
  tracking_token_hash,
  tracking_resolution_status,
  resolved_redirect_url,
  request_ip_hash,
  attribution_sub1,
  attribution_sub2,
  attribution_sub3,
  attribution_sub4,
  attribution_sub5,
  attribution_utm_source,
  attribution_utm_medium,
  attribution_utm_campaign,
  attribution_utm_content,
  attribution_utm_term,
  request_user_agent,
  request_referer,
  request_id,
  clicked_at,
  created_at
)
SELECT
  id,
  organization_id,
  offer_assignment_id,
  offer_id,
  publisher_id,
  advertiser_id,
  tracking_token_hash,
  tracking_resolution_status,
  resolved_redirect_url,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  request_user_agent,
  request_referer,
  request_id,
  clicked_at,
  created_at
FROM clicks;

DROP TABLE clicks;

ALTER TABLE clicks_privacy_boundary RENAME TO clicks;

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

CREATE INDEX IF NOT EXISTS clicks_request_ip_hash_idx
  ON clicks (request_ip_hash);
