DROP INDEX IF EXISTS offers_organization_viewer_membership_status_idx;

ALTER TABLE offers
  DROP COLUMN IF EXISTS viewer_membership_id;
