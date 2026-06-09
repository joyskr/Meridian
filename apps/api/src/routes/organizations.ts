import { Router } from 'express';
import { createOrganizationSchema, selectActiveOrganizationSchema } from '../modules/organizations/organization-schema.js';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { OrganizationService } from '../modules/organizations/organization-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';

type OrganizationsRouterDependencies = {
  authService: AuthService;
  organizationService: OrganizationService;
  config: RuntimeConfig;
};

export function createOrganizationsRouter({
  authService,
  organizationService,
  config
}: OrganizationsRouterDependencies) {
  const organizationsRouter = Router();

  organizationsRouter.post('/organizations', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const body = parseBody(createOrganizationSchema, request.body);
      const result = await organizationService.createOrganization(actor, body.name);

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  organizationsRouter.get('/organizations', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const result = await organizationService.listOrganizations(actor);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  organizationsRouter.get('/organizations/current', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const result = await organizationService.getCurrentOrganization(actor);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  organizationsRouter.post('/organizations/select-active', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const body = parseBody(selectActiveOrganizationSchema, request.body);
      const result = await organizationService.selectActiveOrganization(actor, body.organization_id);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return organizationsRouter;
}
