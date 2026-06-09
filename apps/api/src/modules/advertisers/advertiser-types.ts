export type AdvertiserStatus = 'active' | 'archived';

export type AdvertiserRecord = {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  notes: string | null;
  status: AdvertiserStatus;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};
