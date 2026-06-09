export type TrackingResolutionStatus = 'accepted';

export type ClickListItem = {
  id: string;
  organization: {
    id: string;
  };
  assignment: {
    id: string;
  };
  offer: {
    id: string;
    name: string;
  };
  publisher: {
    id: string;
    name: string;
  };
  advertiser: {
    id: string;
    name: string;
  };
  clicked_at: string;
  tracking_resolution_status: TrackingResolutionStatus;
};

export type ClickDetail = ClickListItem & {
  tracking_resolution: {
    status: TrackingResolutionStatus;
    redirect_url: string;
  };
  request_metadata: {
    ip_hash: string | null;
    attribution: {
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
    user_agent: string | null;
    referer: string | null;
    request_id: string | null;
  };
};

export type ListClicksResponse = {
  clicks: ClickListItem[];
};

export type ClickDetailResponse = {
  click: ClickDetail;
};

export type ListClicksQuery = {
  assignment_id?: string;
  offer_id?: string;
  publisher_id?: string;
  advertiser_id?: string;
};
