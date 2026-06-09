import { Router } from 'express';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import type { OfferService } from '../modules/offers/offer-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import {
  createOfferSchema,
  listOffersQuerySchema,
  updateOfferSchema
} from '../modules/offers/offer-schema.js';

type OffersRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  offerService: OfferService;
  config: RuntimeConfig;
};

export function createOffersRouter({
  authService,
  membershipService,
  offerService,
  config
}: OffersRouterDependencies) {
  const offersRouter = Router();

  offersRouter.post('/offers', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(createOfferSchema, request.body);
      const result = await offerService.createOffer(organizationActor, {
        advertiserId: body.advertiser_id,
        name: body.name,
        description: body.description ?? null,
        trackingSlug: body.tracking_slug ?? null,
        terms: body.terms ?? null,
        startAt: body.start_at ?? null,
        endAt: body.end_at ?? null,
        dailyCap: body.daily_cap ?? null,
        monthlyCap: body.monthly_cap ?? null,
        overallCap: body.overall_cap ?? null,
        eventDefinitions: body.event_definitions.map((definition) => ({
          eventCode: definition.event_code,
          eventName: definition.event_name,
          advertiserPayout: definition.advertiser_payout
        }))
      });

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.get('/offers', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listOffersQuerySchema, request.query);
      const result = await offerService.listOffers(organizationActor, query.status);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.get('/offers/:offerId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerService.getOffer(organizationActor, request.params.offerId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.patch('/offers/:offerId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(updateOfferSchema, request.body);
      const result = await offerService.updateOffer(organizationActor, request.params.offerId, {
        advertiserId: body.advertiser_id,
        name: body.name,
        description: body.description,
        trackingSlug: body.tracking_slug,
        terms: body.terms,
        startAt: body.start_at,
        endAt: body.end_at,
        dailyCap: body.daily_cap,
        monthlyCap: body.monthly_cap,
        overallCap: body.overall_cap,
        eventDefinitions: body.event_definitions?.map((definition) => ({
          eventCode: definition.event_code,
          eventName: definition.event_name,
          advertiserPayout: definition.advertiser_payout
        }))
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.post('/offers/:offerId/activate', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerService.activateOffer(organizationActor, request.params.offerId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.post('/offers/:offerId/pause', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerService.pauseOffer(organizationActor, request.params.offerId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.post('/offers/:offerId/resume', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerService.resumeOffer(organizationActor, request.params.offerId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.post('/offers/:offerId/archive', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerService.archiveOffer(organizationActor, request.params.offerId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  offersRouter.post('/offers/:offerId/restore', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerService.restoreOffer(organizationActor, request.params.offerId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return offersRouter;
}
