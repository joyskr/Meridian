import { Router } from 'express';
import type { ApprovedAttributionParameters } from '../modules/tracking/tracking-types.js';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import type { TrackingService } from '../modules/tracking/tracking-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import { listClicksQuerySchema } from '../modules/tracking/tracking-schema.js';

type TrackingRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  trackingService: TrackingService;
  config: RuntimeConfig;
};

export function createTrackingRouter({
  authService,
  membershipService,
  trackingService,
  config
}: TrackingRouterDependencies) {
  const router = Router();

  router.get('/t/:trackingToken', async (request, response, next) => {
    try {
      const result = await trackingService.ingestClick(request.params.trackingToken, {
        attribution: extractApprovedAttributionParameters(request.query),
        ipAddress: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
        referer: request.header('referer') ?? null,
        requestId: response.locals.requestId ?? null
      });

      response.redirect(302, result.redirectUrl);
    } catch (error) {
      next(error);
    }
  });

  router.get('/tracking/clicks', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listClicksQuerySchema, request.query);
      const result = await trackingService.listClicks(organizationActor, {
        assignmentId: query.assignment_id,
        offerId: query.offer_id,
        publisherId: query.publisher_id,
        advertiserId: query.advertiser_id
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/tracking/clicks/:clickId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await trackingService.getClick(organizationActor, request.params.clickId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function extractApprovedAttributionParameters(query: unknown): ApprovedAttributionParameters {
  const queryRecord =
    query && typeof query === 'object' && !Array.isArray(query)
      ? (query as Record<string, unknown>)
      : {};

  return {
    sub1: getFirstQueryValue(queryRecord.sub1),
    sub2: getFirstQueryValue(queryRecord.sub2),
    sub3: getFirstQueryValue(queryRecord.sub3),
    sub4: getFirstQueryValue(queryRecord.sub4),
    sub5: getFirstQueryValue(queryRecord.sub5),
    utm_source: getFirstQueryValue(queryRecord.utm_source),
    utm_medium: getFirstQueryValue(queryRecord.utm_medium),
    utm_campaign: getFirstQueryValue(queryRecord.utm_campaign),
    utm_content: getFirstQueryValue(queryRecord.utm_content),
    utm_term: getFirstQueryValue(queryRecord.utm_term)
  };
}

function getFirstQueryValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    return getFirstQueryValue(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  return value.length > 0 ? value : null;
}
