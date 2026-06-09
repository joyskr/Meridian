export type AdvertiserStatus = 'active' | 'archived';

export type Advertiser = {
  id: string;
  name: string;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  notes: string | null;
  status: AdvertiserStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ListAdvertisersResponse = {
  advertisers: Advertiser[];
};

export type AdvertiserDetailResponse = {
  advertiser: Advertiser;
};

export type CreateAdvertiserRequest = {
  name: string;
  website_url: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  notes: string | null;
};

export type CreateAdvertiserResponse = AdvertiserDetailResponse;

export type UpdateAdvertiserRequest = {
  name?: string;
  website_url?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  notes?: string | null;
};

export type UpdateAdvertiserResponse = AdvertiserDetailResponse;

export type ArchiveAdvertiserResponse = AdvertiserDetailResponse;

export type RestoreAdvertiserResponse = AdvertiserDetailResponse;
