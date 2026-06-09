import { Router } from 'express';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';
import type { MembershipService } from '../modules/memberships/membership-service.js';
import type { PayoutService } from '../modules/payouts/payout-service.js';
import { parseBody } from '../platform/http/validation.js';
import { requireAuthenticatedActor } from '../platform/http/authenticated-session.js';
import {
  listPayoutBatchesQuerySchema,
  listPayoutsQuerySchema
} from '../modules/payouts/payout-schema.js';

type PayoutsRouterDependencies = {
  authService: AuthService;
  membershipService: MembershipService;
  payoutService: PayoutService;
  config: RuntimeConfig;
};

export function createPayoutsRouter({
  authService,
  membershipService,
  payoutService,
  config
}: PayoutsRouterDependencies) {
  const router = Router();

  router.post('/payout-batches/preview', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await payoutService.previewBatch(organizationActor);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/payout-batches', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await payoutService.createBatch(organizationActor);

      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/payout-batches', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listPayoutBatchesQuerySchema, request.query);
      const result = await payoutService.listBatches(organizationActor, query.status);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/payout-batches/:batchId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await payoutService.getBatch(organizationActor, request.params.batchId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/payout-batches/:batchId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      await payoutService.deleteDraftBatch(organizationActor, request.params.batchId);

      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/payout-batches/:batchId/approve', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await payoutService.approveBatch(organizationActor, request.params.batchId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/payout-batches/:batchId/export', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await payoutService.exportBatch(organizationActor, request.params.batchId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/payout-batches/:batchId/reconcile', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await payoutService.reconcileBatch(organizationActor, request.params.batchId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/payouts', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const query = parseBody(listPayoutsQuerySchema, request.query);
      const result = await payoutService.listPayouts(organizationActor, {
        batchId: query.batch_id
      });

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/payouts/:payoutId', async (request, response, next) => {
    try {
      const actor = await requireAuthenticatedActor(request, authService, config);
      const organizationActor = await membershipService.requireOrganizationActor(actor);
      const result = await payoutService.getPayout(organizationActor, request.params.payoutId);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
