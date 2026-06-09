import { Router } from 'express';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import {
  assignMembershipManagerSchema,
  provisionMembershipUserSchema,
  updateMembershipRoleSchema
} from '../modules/memberships/membership-schema.js';

type MembershipRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  config: RuntimeConfig;
};

export function createMembershipsRouter({
  authService,
  membershipService,
  config
}: MembershipRouterDependencies) {
  const membershipsRouter = Router();

  membershipsRouter.get('/memberships', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await membershipService.listMemberships(organizationActor);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  membershipsRouter.get('/memberships/:membershipId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await membershipService.getMembership(
        organizationActor,
        request.params.membershipId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  membershipsRouter.post('/memberships/provision-user', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(provisionMembershipUserSchema, request.body);
      const result = await membershipService.provisionEmployeeAccount(organizationActor, {
        email: body.email,
        role: body.role,
        managerMembershipId: body.manager_membership_id
      });

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  membershipsRouter.patch('/memberships/:membershipId/role', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(updateMembershipRoleSchema, request.body);
      const result = await membershipService.updateMembershipRole(
        organizationActor,
        request.params.membershipId,
        body.role
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  membershipsRouter.patch('/memberships/:membershipId/manager', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(assignMembershipManagerSchema, request.body);
      const result = await membershipService.assignManager(
        organizationActor,
        request.params.membershipId,
        body.manager_membership_id
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  membershipsRouter.delete('/memberships/:membershipId/manager', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await membershipService.removeManager(
        organizationActor,
        request.params.membershipId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  membershipsRouter.patch('/memberships/:membershipId/deactivate', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await membershipService.deactivateMembership(
        organizationActor,
        request.params.membershipId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return membershipsRouter;
}
