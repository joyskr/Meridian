export type PublisherStatus = 'active' | 'archived';
export type PublisherTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

export type PublisherRecord = {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  notes: string | null;
  publisher_tier: PublisherTier;
  publisher_postback_percent: number;
  status: PublisherStatus;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type PublisherTierSettingRecord = {
  organization_id: string;
  tier: PublisherTier;
  payout_percent: number;
  created_at: Date;
  updated_at: Date;
};
