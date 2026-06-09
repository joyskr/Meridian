export type PublisherStatus = 'active' | 'archived';
export type PublisherTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

export type Publisher = {
  id: string;
  name: string;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  notes: string | null;
  publisher_tier: PublisherTier;
  publisher_postback_percent: number;
  status: PublisherStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ListPublishersResponse = {
  publishers: Publisher[];
};

export type PublisherDetailResponse = {
  publisher: Publisher;
};

export type CreatePublisherRequest = {
  name: string;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  notes: string | null;
  publisher_tier?: PublisherTier;
  publisher_postback_percent?: number | null;
};

export type CreatePublisherResponse = PublisherDetailResponse;

export type UpdatePublisherRequest = {
  name?: string;
  website_url?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  notes?: string | null;
  publisher_tier?: PublisherTier;
  publisher_postback_percent?: number | null;
};

export type UpdatePublisherResponse = PublisherDetailResponse;

export type ArchivePublisherResponse = PublisherDetailResponse;

export type RestorePublisherResponse = PublisherDetailResponse;

export type PublisherTierSettings = {
  tier_1: number;
  tier_2: number;
  tier_3: number;
  tier_4: number;
  updated_at: string | null;
};

export type PublisherTierSettingsResponse = {
  tier_settings: PublisherTierSettings;
};

export type UpdatePublisherTierSettingsRequest = {
  tier_1: number;
  tier_2: number;
  tier_3: number;
  tier_4: number;
};
