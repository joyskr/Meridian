import { Router } from 'express';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import type { AdvertiserService } from '../modules/advertisers/advertiser-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import {
  createAdvertiserSchema,
  listAdvertisersQuerySchema,
  updateAdvertiserSchema
} from '../modules/advertisers/advertiser-schema.js';

type AdvertisersRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  advertiserService: AdvertiserService;
  config: RuntimeConfig;
};

export function createAdvertisersRouter({
  authService,
  membershipService,
  advertiserService,
  config
}: AdvertisersRouterDependencies) {
  const advertisersRouter = Router();

  advertisersRouter.post('/advertisers', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(createAdvertiserSchema, request.body);
      const result = await advertiserService.createAdvertiser(organizationActor, {
        name: body.name,
        websiteUrl: body.website_url ?? null,
        primaryContactName: body.primary_contact_name ?? null,
        primaryContactEmail: body.primary_contact_email ?? null,
        notes: body.notes ?? null
      });

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  advertisersRouter.get('/advertisers', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listAdvertisersQuerySchema, request.query);
      const result = await advertiserService.listAdvertisers(organizationActor, query.status);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  advertisersRouter.get('/advertisers/:advertiserId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await advertiserService.getAdvertiser(
        organizationActor,
        request.params.advertiserId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  advertisersRouter.patch('/advertisers/:advertiserId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(updateAdvertiserSchema, request.body);
      const result = await advertiserService.updateAdvertiser(organizationActor, request.params.advertiserId, {
        name: body.name,
        websiteUrl: body.website_url,
        primaryContactName: body.primary_contact_name,
        primaryContactEmail: body.primary_contact_email,
        notes: body.notes
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  advertisersRouter.post('/advertisers/:advertiserId/archive', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await advertiserService.archiveAdvertiser(
        organizationActor,
        request.params.advertiserId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  advertisersRouter.post('/advertisers/:advertiserId/restore', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await advertiserService.restoreAdvertiser(
        organizationActor,
        request.params.advertiserId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return advertisersRouter;
}
