export type OfferStatus = 'draft' | 'active' | 'paused' | 'archived';

export type OfferEventDefinition = {
  id: string;
  event_code: string;
  event_name: string;
  advertiser_payout: string;
};

export type OfferAdvertiserSummary = {
  id: string;
  name: string;
};

export type OfferListItem = {
  id: string;
  advertiser: OfferAdvertiserSummary;
  name: string;
  tracking_slug: string | null;
  status: OfferStatus;
  event_count: number;
  created_at: string;
  updated_at: string;
};

export type Offer = {
  id: string;
  advertiser: OfferAdvertiserSummary;
  name: string;
  description: string | null;
  tracking_slug: string | null;
  terms: string | null;
  start_at: string | null;
  end_at: string | null;
  daily_cap: number | null;
  monthly_cap: number | null;
  overall_cap: number | null;
  status: OfferStatus;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  event_definitions: OfferEventDefinition[];
};

export type CreateOfferEventDefinitionRequest = {
  event_code: string;
  event_name: string;
  advertiser_payout: string;
};

export type UpdateOfferEventDefinitionRequest = CreateOfferEventDefinitionRequest;

export type ListOffersResponse = {
  offers: OfferListItem[];
};

export type OfferDetailResponse = {
  offer: Offer;
};

export type CreateOfferRequest = {
  advertiser_id: string;
  name: string;
  description: string | null;
  tracking_slug: string | null;
  terms: string | null;
  start_at: string | null;
  end_at: string | null;
  daily_cap: number | null;
  monthly_cap: number | null;
  overall_cap: number | null;
  event_definitions: CreateOfferEventDefinitionRequest[];
};

export type CreateOfferResponse = OfferDetailResponse;

export type UpdateOfferRequest = {
  advertiser_id?: string;
  name?: string;
  description?: string | null;
  tracking_slug?: string | null;
  terms?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  daily_cap?: number | null;
  monthly_cap?: number | null;
  overall_cap?: number | null;
  event_definitions?: UpdateOfferEventDefinitionRequest[];
};

export type UpdateOfferResponse = OfferDetailResponse;

export type ListOffersQueryStatus = 'draft' | 'active' | 'paused' | 'archived' | 'all';
export type ActivateOfferResponse = OfferDetailResponse;
export type PauseOfferResponse = OfferDetailResponse;
export type ResumeOfferResponse = OfferDetailResponse;
export type ArchiveOfferResponse = OfferDetailResponse;
export type RestoreOfferResponse = OfferDetailResponse;
