import type { PublisherPayoutSource } from './conversions.js';
import type { ConversionSourceSurface } from './conversions.js';

export type PayoutBatchStatus = 'draft' | 'approved' | 'exported' | 'reconciled';

export type PayoutPreviewItem = {
  conversion_id: string;
  click_id: string;
  offer: {
    id: string;
    name: string | null;
  };
  assignment: {
    id: string;
  };
  publisher: {
    id: string;
    name: string | null;
  };
  advertiser: {
    id: string;
    name: string;
  };
  event_type: string;
  source_surface: ConversionSourceSurface;
  finalized_at: string;
  financial_snapshot: {
    advertiser_payout: string;
    publisher_payout: string;
    publisher_payout_source: PublisherPayoutSource;
    publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
    publisher_tier_percent: number;
    assignment_override_amount: string | null;
  };
};

export type PayoutBatchPreview = {
  payout_count: number;
  advertiser_payout_total: string;
  publisher_payout_total: string;
  payouts: PayoutPreviewItem[];
};

export type PayoutSummary = {
  id: string;
  batch_id: string;
  batch_status: PayoutBatchStatus;
  conversion_id: string;
  click_id: string;
  offer: {
    id: string;
    name: string | null;
  };
  assignment: {
    id: string;
  };
  publisher: {
    id: string;
    name: string | null;
  };
  advertiser: {
    id: string;
    name: string;
  };
  event_type: string;
  source_surface: ConversionSourceSurface;
  finalized_at: string;
  advertiser_payout: string;
  publisher_payout: string;
  created_at: string;
};

export type PayoutDetail = PayoutSummary & {
  publisher_payout_source: PublisherPayoutSource;
  publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  publisher_tier_percent: number;
  assignment_override_amount: string | null;
};

export type PayoutBatchSummary = {
  id: string;
  status: PayoutBatchStatus;
  payout_count: number;
  advertiser_payout_total: string;
  publisher_payout_total: string;
  created_at: string;
  approved_at: string | null;
  exported_at: string | null;
  reconciled_at: string | null;
};

export type PayoutBatchDetail = PayoutBatchSummary & {
  payouts: PayoutDetail[];
};

export type PayoutBatchPreviewResponse = {
  preview: PayoutBatchPreview;
};

export type PayoutBatchDetailResponse = {
  batch: PayoutBatchDetail;
};

export type ListPayoutBatchesResponse = {
  batches: PayoutBatchSummary[];
};

export type ListPayoutsResponse = {
  payouts: PayoutSummary[];
};

export type PayoutDetailResponse = {
  payout: PayoutDetail;
};

export type ListPayoutBatchesQuery = {
  status?: PayoutBatchStatus | 'all';
};

export type ListPayoutsQuery = {
  batch_id?: string;
};
