import type { PublisherTier } from './publishers.js';

export type OfferAssignmentStatus = 'active' | 'paused' | 'archived';

export type OfferAssignmentSummary = {
  id: string;
  offer: {
    id: string;
    name: string;
  };
  publisher: {
    id: string;
    name: string;
    publisher_tier: PublisherTier;
    publisher_postback_percent: number;
    tier_payout_percent: number;
  };
  conversion_visibility_percent: number;
  postback_percent: number;
  effective_postback_percent: number;
  redirect_url: string;
  payout_override_count: number;
  status: OfferAssignmentStatus;
  created_at: string;
  updated_at: string;
};

export type OfferAssignmentPayoutOverride = {
  id: string;
  event_code: string;
  event_name: string;
  publisher_payout_amount: string;
};

export type OfferAssignment = {
  id: string;
  offer: {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'archived';
  };
  publisher: {
    id: string;
    name: string;
    status: 'active' | 'archived';
    publisher_tier: PublisherTier;
    publisher_postback_percent: number;
    tier_payout_percent: number;
  };
  conversion_visibility_percent: number;
  postback_percent: number;
  effective_postback_percent: number;
  redirect_url: string;
  payout_overrides: OfferAssignmentPayoutOverride[];
  tracking_link: {
    tracking_path: string;
  };
  status: OfferAssignmentStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateOfferAssignmentPayoutOverrideRequest = {
  event_code: string;
  publisher_payout_amount: string;
};

export type CreateOfferAssignmentRequest = {
  offer_id: string;
  publisher_id: string;
  redirect_url: string;
  conversion_visibility_percent?: number | null;
  postback_percent?: number | null;
  payout_overrides?: CreateOfferAssignmentPayoutOverrideRequest[];
};

export type UpdateOfferAssignmentRequest = {
  redirect_url?: string;
  conversion_visibility_percent?: number | null;
  postback_percent?: number | null;
  payout_overrides?: CreateOfferAssignmentPayoutOverrideRequest[];
};

export type ListOfferAssignmentsResponse = {
  assignments: OfferAssignmentSummary[];
};

export type OfferAssignmentDetailResponse = {
  assignment: OfferAssignment;
};

export type OfferAssignmentTrackingLinkResponse = {
  tracking_link: {
    assignment_id: string;
    tracking_path: string;
  };
};
