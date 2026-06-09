import { Router } from 'express';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import type { OfferAssignmentService } from '../modules/offer-assignments/offer-assignment-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import {
  createOfferAssignmentSchema,
  listOfferAssignmentsQuerySchema,
  updateOfferAssignmentSchema
} from '../modules/offer-assignments/offer-assignment-schema.js';

type OfferAssignmentsRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  offerAssignmentService: OfferAssignmentService;
  config: RuntimeConfig;
};

export function createOfferAssignmentsRouter({
  authService,
  membershipService,
  offerAssignmentService,
  config
}: OfferAssignmentsRouterDependencies) {
  const router = Router();

  router.post('/offer-assignments', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(createOfferAssignmentSchema, request.body);
      const result = await offerAssignmentService.createAssignment(organizationActor, {
        offerId: body.offer_id,
        publisherId: body.publisher_id,
        redirectUrl: body.redirect_url,
        conversionVisibilityPercent: body.conversion_visibility_percent ?? null,
        postbackPercent: body.postback_percent ?? null,
        payoutOverrides:
          body.payout_overrides?.map((override) => ({
            eventCode: override.event_code,
            publisherPayoutAmount: override.publisher_payout_amount
          })) ?? []
      });

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/offer-assignments', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listOfferAssignmentsQuerySchema, request.query);
      const result = await offerAssignmentService.listAssignments(organizationActor, query.status);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/offer-assignments/:assignmentId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerAssignmentService.getAssignment(
        organizationActor,
        request.params.assignmentId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/offer-assignments/:assignmentId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const body = parseBody(updateOfferAssignmentSchema, request.body);
      const result = await offerAssignmentService.updateAssignment(
        organizationActor,
        request.params.assignmentId,
        {
          redirectUrl: body.redirect_url,
          conversionVisibilityPercent: body.conversion_visibility_percent,
          postbackPercent: body.postback_percent,
          payoutOverrides: body.payout_overrides?.map((override) => ({
            eventCode: override.event_code,
            publisherPayoutAmount: override.publisher_payout_amount
          }))
        }
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/offer-assignments/:assignmentId/pause', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerAssignmentService.pauseAssignment(
        organizationActor,
        request.params.assignmentId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/offer-assignments/:assignmentId/resume', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerAssignmentService.resumeAssignment(
        organizationActor,
        request.params.assignmentId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/offer-assignments/:assignmentId/archive', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerAssignmentService.archiveAssignment(
        organizationActor,
        request.params.assignmentId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/offer-assignments/:assignmentId/restore', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerAssignmentService.restoreAssignment(
        organizationActor,
        request.params.assignmentId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/offer-assignments/:assignmentId/tracking-link', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await offerAssignmentService.getTrackingLink(
        organizationActor,
        request.params.assignmentId
      );

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
