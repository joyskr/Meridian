export type ConversionSourceSurface = 'ingest' | 'gpixel' | 'goal';

export type ConversionStatus = 'received' | 'finalized' | 'rejected';

export type ConversionRejectionReason =
  | 'click_not_found'
  | 'unknown_event_type'
  | 'attribution_conflict';

export type PublicConversionRequest = {
  advertiser_id: string;
  event_type: string;
  external_event_id?: string;
  idempotency_key?: string;
  click_id?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
  occurred_at?: string;
};

export type PublicConversion = {
  id: string;
  advertiser_id: string;
  offer_assignment_id: string | null;
  click_id: string | null;
  offer_id: string | null;
  publisher_id: string | null;
  source_surface: ConversionSourceSurface;
  event_type: string;
  external_event_id: string | null;
  idempotency_key: string | null;
  status: ConversionStatus;
  rejection_reason: ConversionRejectionReason | null;
  occurred_at: string | null;
  received_at: string;
  finalized_at: string | null;
};

export type PublisherPayoutSource = 'assignment_override' | 'publisher_tier';

export type IngestConversionResponse = {
  outcome: 'created' | 'duplicate';
  conversion: PublicConversion;
};

export type ConversionListItem = {
  id: string;
  advertiser: {
    id: string;
    name: string;
  };
  offer: {
    id: string;
    name: string | null;
  } | null;
  publisher: {
    id: string;
    name: string | null;
  } | null;
  assignment: {
    id: string;
  } | null;
  click: {
    id: string;
  } | null;
  source_surface: ConversionSourceSurface;
  event_type: string;
  status: ConversionStatus;
  rejection_reason: ConversionRejectionReason | null;
  occurred_at: string | null;
  received_at: string;
  finalized_at: string | null;
};

export type ConversionDetail = ConversionListItem & {
  external_event_id: string | null;
  idempotency_key: string | null;
  lookup_inputs: {
    click_id: string | null;
    sub1: string | null;
    sub2: string | null;
    sub3: string | null;
    sub4: string | null;
    sub5: string | null;
  };
  financial_snapshot: {
    advertiser_payout: string | null;
    publisher_payout: string | null;
    publisher_payout_source: PublisherPayoutSource | null;
    publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | null;
    publisher_tier_percent: number | null;
    assignment_override_amount: string | null;
  };
  visibility_snapshot: {
    conversion_visibility_percent: number | null;
    conversion_visible_to_publisher: boolean | null;
  };
  postback_snapshot: {
    publisher_postback_percent: number | null;
    assignment_postback_percent: number | null;
    effective_postback_percent: number | null;
    postback_eligible: boolean | null;
  };
};

export type ListConversionsResponse = {
  conversions: ConversionListItem[];
};

export type ConversionDetailResponse = {
  conversion: ConversionDetail;
};

export type ReprocessConversionResponse = ConversionDetailResponse;

export type ListConversionsQuery = {
  status?: 'received' | 'finalized' | 'rejected' | 'all';
  advertiser_id?: string;
  offer_id?: string;
  publisher_id?: string;
  click_id?: string;
};
