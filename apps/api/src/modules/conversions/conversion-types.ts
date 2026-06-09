export type ConversionSourceSurface = 'ingest' | 'gpixel' | 'goal';

export type ConversionStatus = 'received' | 'finalized' | 'rejected';
export type PublisherPayoutSource = 'assignment_override' | 'publisher_tier';

export type PersistedConversionRejectionReason =
  | 'click_not_found'
  | 'unknown_event_type'
  | 'attribution_conflict';

export type ConversionRecord = {
  id: string;
  organization_id: string;
  advertiser_id: string;
  offer_assignment_id: string | null;
  click_id: string | null;
  offer_id: string | null;
  publisher_id: string | null;
  source_surface: ConversionSourceSurface;
  event_type: string;
  external_event_id: string | null;
  idempotency_key: string | null;
  lookup_click_id: string | null;
  lookup_sub1: string | null;
  lookup_sub2: string | null;
  lookup_sub3: string | null;
  lookup_sub4: string | null;
  lookup_sub5: string | null;
  status: ConversionStatus;
  rejection_reason: PersistedConversionRejectionReason | null;
  occurred_at: Date | null;
  received_at: Date;
  finalized_at: Date | null;
  advertiser_payout: string | null;
  publisher_payout: string | null;
  publisher_payout_source: PublisherPayoutSource | null;
  publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | null;
  publisher_tier_percent: number | null;
  assignment_override_amount: string | null;
  conversion_visibility_percent: number | null;
  conversion_visible_to_publisher: boolean | null;
  publisher_postback_percent: number | null;
  assignment_postback_percent: number | null;
  effective_postback_percent: number | null;
  postback_eligible: boolean | null;
  created_at: Date;
  updated_at: Date;
};

export type ConversionWithRelationsRecord = ConversionRecord & {
  advertiser_name: string;
  offer_name: string | null;
  publisher_name: string | null;
};

export type ConversionAdvertiserSourceRecord = {
  id: string;
  organization_id: string;
  name: string;
  status: 'active' | 'archived';
};

export type ConversionClickLookupRecord = {
  id: string;
  organization_id: string;
  offer_assignment_id: string;
  offer_id: string;
  publisher_id: string;
  advertiser_id: string;
};

export type ConversionOfferEventDefinitionRecord = {
  offer_id: string;
  event_code: string;
  event_name: string;
  advertiser_payout: string;
};

export type ConversionFinalizationContextRecord = {
  organization_id: string;
  offer_assignment_id: string;
  offer_id: string;
  publisher_id: string;
  advertiser_id: string;
  publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  publisher_tier_percent: number;
  publisher_postback_percent: number;
  assignment_postback_percent: number;
  conversion_visibility_percent: number;
  assignment_override_amount: string | null;
};

export type ConversionLookupInputs = {
  click_id: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
  sub5: string | null;
};

export type NormalizedConversionInput = {
  advertiserId: string;
  eventType: string;
  externalEventId: string | null;
  idempotencyKey: string | null;
  occurredAt: Date | null;
  lookupInputs: ConversionLookupInputs;
};

export type ConversionAuditLogRecord = {
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

export type ConversionPayoutReservationRecord = {
  payout_id: string;
  batch_id: string;
  batch_status: 'draft' | 'approved' | 'exported' | 'reconciled';
};
