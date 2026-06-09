import type { AdvertiserStatus } from '../advertisers/advertiser-types.js';

export type OfferStatus = 'draft' | 'active' | 'paused' | 'archived';

export type OfferRecord = {
  id: string;
  organization_id: string;
  advertiser_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  tracking_slug: string | null;
  terms: string | null;
  start_at: Date | null;
  end_at: Date | null;
  daily_cap: number | null;
  monthly_cap: number | null;
  overall_cap: number | null;
  status: OfferStatus;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OfferWithAdvertiserRecord = OfferRecord & {
  advertiser_name: string;
  advertiser_status: AdvertiserStatus;
};

export type OfferEventDefinitionRecord = {
  id: string;
  offer_id: string;
  event_code: string;
  event_name: string;
  advertiser_payout: string;
  created_at: Date;
  updated_at: Date;
};

export type OfferAdvertiserSummaryRecord = {
  id: string;
  name: string;
  status: AdvertiserStatus;
};
