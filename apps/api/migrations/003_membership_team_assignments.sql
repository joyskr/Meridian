ALTER TABLE memberships
  ADD COLUMN manager_membership_id TEXT NULL REFERENCES memberships(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS memberships_manager_membership_idx
  ON memberships (manager_membership_id);
