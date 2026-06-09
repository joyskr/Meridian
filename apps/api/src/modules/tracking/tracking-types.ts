import type { AdvertiserStatus } from '../advertisers/advertiser-types.js';
import type { OfferAssignmentStatus } from '../offer-assignments/offer-assignment-types.js';
import type { OfferStatus } from '../offers/offer-types.js';
import type { PublisherStatus } from '../publishers/publisher-types.js';

export type ClickResolutionStatus = 'accepted';

export type ClickRecord = {
  id: string;
  organization_id: string;
  offer_assignment_id: string;
  offer_id: string;
  publisher_id: string;
  advertiser_id: string;
  tracking_token_hash: string;
  tracking_resolution_status: ClickResolutionStatus;
  resolved_redirect_url: string;
  request_ip_hash: string | null;
  attribution_sub1: string | null;
  attribution_sub2: string | null;
  attribution_sub3: string | null;
  attribution_sub4: string | null;
  attribution_sub5: string | null;
  attribution_utm_source: string | null;
  attribution_utm_medium: string | null;
  attribution_utm_campaign: string | null;
  attribution_utm_content: string | null;
  attribution_utm_term: string | null;
  request_user_agent: string | null;
  request_referer: string | null;
  request_id: string | null;
  clicked_at: Date;
  created_at: Date;
};

export type ApprovedAttributionParameters = {
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
  sub5: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

export type ClickWithRelationsRecord = ClickRecord & {
  organization_name: string;
  offer_name: string;
  publisher_name: string;
  advertiser_name: string;
};

export type TrackingAssignmentResolutionRecord = {
  assignment_id: string;
  organization_id: string;
  organization_name: string;
  offer_id: string;
  offer_name: string;
  offer_status: OfferStatus;
  publisher_id: string;
  publisher_name: string;
  publisher_status: PublisherStatus;
  advertiser_id: string;
  advertiser_name: string;
  advertiser_status: AdvertiserStatus;
  assignment_status: OfferAssignmentStatus;
  redirect_url: string | null;
};
