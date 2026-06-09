import { AppError } from '../../platform/http/shared-error.js';
import { createHash } from 'node:crypto';
import { createPublicId } from '../../platform/security/ids.js';
import { hashOpaqueToken } from '../../platform/security/token.js';
import type { RuntimeConfig } from '../../platform/config/env.js';
import type { OrganizationActor } from '../memberships/membership-types.js';
import { TrackingRepository } from './tracking-repository.js';
import type {
  ApprovedAttributionParameters,
  ClickWithRelationsRecord,
  TrackingAssignmentResolutionRecord
} from './tracking-types.js';

const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

export class TrackingService {
  constructor(
    private readonly repository: TrackingRepository,
    private readonly config: RuntimeConfig
  ) {}

  async ingestClick(
    trackingToken: string,
    requestContext: {
      attribution: ApprovedAttributionParameters;
      ipAddress: string | null;
      userAgent: string | null;
      referer: string | null;
      requestId: string | null;
    }
  ) {
    validateTrackingToken(trackingToken);

    const resolution = await this.repository.findTrackingAssignmentByToken(trackingToken);
    ensureTrackingResolutionAvailable(resolution);

    const click = await this.repository.createClick({
      id: createPublicId('clk'),
      organizationId: resolution.organization_id,
      assignmentId: resolution.assignment_id,
      offerId: resolution.offer_id,
      publisherId: resolution.publisher_id,
      advertiserId: resolution.advertiser_id,
      trackingTokenHash: hashOpaqueToken(trackingToken, this.config.sessionSecret),
      trackingResolutionStatus: 'accepted',
      resolvedRedirectUrl: resolution.redirect_url as string,
      requestIpHash: hashIpAddress(requestContext.ipAddress, this.config.sessionSecret),
      attribution: requestContext.attribution,
      requestUserAgent: requestContext.userAgent,
      requestReferer: requestContext.referer,
      requestId: requestContext.requestId,
      clickedAt: new Date()
    });

    return {
      click,
      redirectUrl: resolution.redirect_url as string
    };
  }

  async listClicks(
    actor: OrganizationActor,
    filters: {
      assignmentId?: string;
      offerId?: string;
      publisherId?: string;
      advertiserId?: string;
    }
  ) {
    ensureClickReadAllowed(actor);

    const clicks = await this.repository.listClicks(actor.organizationId, filters);

    return {
      clicks: clicks.map(presentClickListItem)
    };
  }

  async getClick(actor: OrganizationActor, clickId: string) {
    ensureClickReadAllowed(actor);

    const click = await this.repository.findClick(actor.organizationId, clickId);

    if (!click) {
      throw new AppError('click_not_found', 'not_found', 'Click not found', 404);
    }

    return {
      click: presentClickDetail(click)
    };
  }
}

function validateTrackingToken(trackingToken: string) {
  if (!TRACKING_TOKEN_PATTERN.test(trackingToken)) {
    throw new AppError(
      'tracking_token_invalid',
      'validation',
      'Tracking token is malformed',
      400
    );
  }
}

function ensureTrackingResolutionAvailable(
  resolution: TrackingAssignmentResolutionRecord | null
): asserts resolution is TrackingAssignmentResolutionRecord & { redirect_url: string } {
  if (
    !resolution ||
    resolution.assignment_status !== 'active' ||
    resolution.offer_status !== 'active' ||
    resolution.publisher_status !== 'active' ||
    resolution.advertiser_status !== 'active' ||
    !resolution.redirect_url
  ) {
    throw new AppError(
      'tracking_unavailable',
      'not_found',
      'Tracking target is unavailable',
      404
    );
  }
}

function ensureClickReadAllowed(actor: OrganizationActor) {
  if (
    actor.membership.role === 'owner' ||
    actor.membership.role === 'admin' ||
    actor.membership.role === 'manager' ||
    actor.membership.role === 'analyst'
  ) {
    return;
  }

  throw new AppError(
    'tracking_read_forbidden',
    'authorization',
    'Current membership cannot read tracking clicks',
    403
  );
}

function presentClickListItem(click: ClickWithRelationsRecord) {
  return {
    id: click.id,
    organization: {
      id: click.organization_id
    },
    assignment: {
      id: click.offer_assignment_id
    },
    offer: {
      id: click.offer_id,
      name: click.offer_name
    },
    publisher: {
      id: click.publisher_id,
      name: click.publisher_name
    },
    advertiser: {
      id: click.advertiser_id,
      name: click.advertiser_name
    },
    clicked_at: click.clicked_at.toISOString(),
    tracking_resolution_status: click.tracking_resolution_status
  };
}

function presentClickDetail(click: ClickWithRelationsRecord) {
  return {
    ...presentClickListItem(click),
    tracking_resolution: {
      status: click.tracking_resolution_status,
      redirect_url: click.resolved_redirect_url
    },
    request_metadata: {
      ip_hash: click.request_ip_hash,
      attribution: presentAttribution(click),
      user_agent: click.request_user_agent,
      referer: click.request_referer,
      request_id: click.request_id
    }
  };
}

function hashIpAddress(ipAddress: string | null, secret: string) {
  if (!ipAddress) {
    return null;
  }

  return createHash('sha256').update(`${secret}:${ipAddress}`).digest('hex');
}

function presentAttribution(click: ClickWithRelationsRecord) {
  return {
    sub1: click.attribution_sub1,
    sub2: click.attribution_sub2,
    sub3: click.attribution_sub3,
    sub4: click.attribution_sub4,
    sub5: click.attribution_sub5,
    utm_source: click.attribution_utm_source,
    utm_medium: click.attribution_utm_medium,
    utm_campaign: click.attribution_utm_campaign,
    utm_content: click.attribution_utm_content,
    utm_term: click.attribution_utm_term
  };
}
