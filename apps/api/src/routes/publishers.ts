import { Router } from 'express';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import type { PublisherService } from '../modules/publishers/publisher-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import {
  createPublisherSchema,
  listPublishersQuerySchema,
  updatePublisherSchema,
  updatePublisherTierSettingsSchema
} from '../modules/publishers/publisher-schema.js';

type PublishersRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  publisherService: PublisherService;
  config: RuntimeConfig;
};

export function createPublishersRouter({
  authService,
  membershipService,
  publisherService,
  config
}: PublishersRouterDependencies) {
  const publishersRouter = Router();

  publishersRouter.post('/publishers', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(createPublisherSchema, request.body);
      const result = await publisherService.createPublisher(organizationActor, {
        name: body.name,
        websiteUrl: body.website_url ?? null,
        primaryContactName: body.primary_contact_name ?? null,
        primaryContactEmail: body.primary_contact_email ?? null,
        notes: body.notes ?? null,
        publisherTier: body.publisher_tier ?? null,
        publisherPostbackPercent: body.publisher_postback_percent ?? null
      });

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  publishersRouter.get('/publishers', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listPublishersQuerySchema, request.query);
      const result = await publisherService.listPublishers(organizationActor, query.status);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  publishersRouter.get('/publishers/:publisherId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await publisherService.getPublisher(
        organizationActor,
        request.params.publisherId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  publishersRouter.patch('/publishers/:publisherId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(updatePublisherSchema, request.body);
      const result = await publisherService.updatePublisher(organizationActor, request.params.publisherId, {
        name: body.name,
        websiteUrl: body.website_url,
        primaryContactName: body.primary_contact_name,
        primaryContactEmail: body.primary_contact_email,
        notes: body.notes,
        publisherTier: body.publisher_tier,
        publisherPostbackPercent: body.publisher_postback_percent
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  publishersRouter.post('/publishers/:publisherId/archive', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await publisherService.archivePublisher(
        organizationActor,
        request.params.publisherId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  publishersRouter.post('/publishers/:publisherId/restore', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await publisherService.restorePublisher(
        organizationActor,
        request.params.publisherId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  publishersRouter.get('/publisher-tier-settings', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await publisherService.getTierSettings(organizationActor);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  publishersRouter.patch('/publisher-tier-settings', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(updatePublisherTierSettingsSchema, request.body);
      const result = await publisherService.updateTierSettings(organizationActor, {
        tier_1: body.tier_1,
        tier_2: body.tier_2,
        tier_3: body.tier_3,
        tier_4: body.tier_4
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return publishersRouter;
}
