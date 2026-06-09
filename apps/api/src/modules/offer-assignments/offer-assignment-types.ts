import type { OfferStatus } from '../offers/offer-types.js';
import type { PublisherStatus, PublisherTier } from '../publishers/publisher-types.js';

export type OfferAssignmentStatus = 'active' | 'paused' | 'archived';

export type OfferAssignmentRecord = {
  id: string;
  organization_id: string;
  offer_id: string;
  publisher_id: string;
  tracking_token: string;
  redirect_url: string | null;
  conversion_visibility_percent: number;
  postback_percent: number;
  status: OfferAssignmentStatus;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OfferAssignmentWithRelationsRecord = OfferAssignmentRecord & {
  offer_name: string;
  offer_status: OfferStatus;
  publisher_name: string;
  publisher_status: PublisherStatus;
  publisher_tier: PublisherTier;
  publisher_postback_percent: number;
};

export type OfferAssignmentPayoutOverrideRecord = {
  id: string;
  offer_assignment_id: string;
  event_code: string;
  publisher_payout_amount: string;
  created_at: Date;
  updated_at: Date;
};

export type OfferAssignmentPayoutOverrideWithEventRecord = OfferAssignmentPayoutOverrideRecord & {
  event_name: string;
};

export type OfferSummaryForAssignmentRecord = {
  id: string;
  organization_id: string;
  name: string;
  status: OfferStatus;
  advertiser_id: string;
};

export type PublisherSummaryForAssignmentRecord = {
  id: string;
  organization_id: string;
  name: string;
  status: PublisherStatus;
  publisher_tier: PublisherTier;
  publisher_postback_percent: number;
};

export type OfferEventDefinitionForAssignmentRecord = {
  event_code: string;
  event_name: string;
  advertiser_payout: string;
};
