import type { ConversionSourceSurface, PublisherPayoutSource } from '../conversions/conversion-types.js';

export type PayoutBatchStatus = 'draft' | 'approved' | 'exported' | 'reconciled';

export type PayoutBatchRecord = {
  id: string;
  organization_id: string;
  status: PayoutBatchStatus;
  approved_at: Date | null;
  exported_at: Date | null;
  reconciled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type PayoutBatchSummaryRecord = PayoutBatchRecord & {
  payout_count: number;
  advertiser_payout_total: string;
  publisher_payout_total: string;
};

export type PayoutRecord = {
  id: string;
  batch_id: string;
  organization_id: string;
  conversion_id: string;
  click_id: string;
  offer_id: string;
  offer_assignment_id: string;
  publisher_id: string;
  advertiser_id: string;
  event_type: string;
  source_surface: ConversionSourceSurface;
  finalized_at: Date;
  advertiser_payout: string;
  publisher_payout: string;
  publisher_payout_source: PublisherPayoutSource;
  publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  publisher_tier_percent: number;
  assignment_override_amount: string | null;
  created_at: Date;
};

export type PayoutWithRelationsRecord = PayoutRecord & {
  batch_status: PayoutBatchStatus;
  advertiser_name: string;
  offer_name: string | null;
  publisher_name: string | null;
};

export type PayoutEligibleConversionRecord = {
  conversion_id: string;
  click_id: string;
  offer_id: string;
  offer_assignment_id: string;
  publisher_id: string;
  advertiser_id: string;
  event_type: string;
  source_surface: ConversionSourceSurface;
  finalized_at: Date;
  advertiser_payout: string;
  publisher_payout: string;
  publisher_payout_source: PublisherPayoutSource;
  publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  publisher_tier_percent: number;
  assignment_override_amount: string | null;
  advertiser_name: string;
  offer_name: string | null;
  publisher_name: string | null;
};

export type PayoutAuditLogRecord = {
  id: string;
  organization_id: string;
  actor_user_id: string;
  actor_membership_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: Date;
};
