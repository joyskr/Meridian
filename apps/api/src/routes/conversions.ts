import { Router } from 'express';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import type { ConversionService } from '../modules/conversions/conversion-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import {
  ingestConversionBodySchema,
  ingestConversionQuerySchema,
  listConversionsQuerySchema
} from '../modules/conversions/conversion-schema.js';

type ConversionsRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  conversionService: ConversionService;
  config: RuntimeConfig;
};

export function createConversionsRouter({
  authService,
  membershipService,
  conversionService,
  config
}: ConversionsRouterDependencies) {
  const router = Router();

  router.post('/conversions/ingest', async (request, response, next) => {
    try {
      const body = parseBody(ingestConversionBodySchema, request.body);
      const result = await conversionService.ingestConversion('ingest', normalizePublicInput(body));

      response.status(result.outcome === 'duplicate' ? 200 : 202).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/gpixel', async (request, response, next) => {
    try {
      const query = parseBody(ingestConversionQuerySchema, request.query);
      const result = await conversionService.ingestConversion('gpixel', normalizePublicInput(query));

      response.status(result.outcome === 'duplicate' ? 200 : 202).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/goal', async (request, response, next) => {
    try {
      const query = parseBody(ingestConversionQuerySchema, request.query);
      const result = await conversionService.ingestConversion('goal', normalizePublicInput(query));

      response.status(result.outcome === 'duplicate' ? 200 : 202).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/conversions', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listConversionsQuerySchema, request.query);
      const result = await conversionService.listConversions(organizationActor, {
        status: query.status,
        advertiserId: query.advertiser_id,
        offerId: query.offer_id,
        publisherId: query.publisher_id,
        clickId: query.click_id
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/conversions/:conversionId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await conversionService.getConversion(
        organizationActor,
        request.params.conversionId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/conversions/:conversionId/reprocess', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await conversionService.reprocessConversion(
        organizationActor,
        request.params.conversionId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function normalizePublicInput(input: {
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
}) {
  return {
    advertiserId: input.advertiser_id,
    eventType: input.event_type,
    externalEventId: input.external_event_id ?? null,
    idempotencyKey: input.idempotency_key ?? null,
    occurredAt: input.occurred_at ? new Date(input.occurred_at) : null,
    lookupInputs: {
      click_id: input.click_id ?? null,
      sub1: input.sub1 ?? null,
      sub2: input.sub2 ?? null,
      sub3: input.sub3 ?? null,
      sub4: input.sub4 ?? null,
      sub5: input.sub5 ?? null
    }
  };
}
