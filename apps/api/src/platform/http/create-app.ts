import express from 'express';
import type { AppRuntime } from '../../app-runtime.js';
import { createAdvertisersRouter } from '../../routes/advertisers.js';
import { createAuthRouter } from '../../routes/auth.js';
import { createConversionsRouter } from '../../routes/conversions.js';
import { createMembershipsRouter } from '../../routes/memberships.js';
import { createOfferAssignmentsRouter } from '../../routes/offer-assignments.js';
import { createOffersRouter } from '../../routes/offers.js';
import { createOrganizationsRouter } from '../../routes/organizations.js';
import { createPayoutsRouter } from '../../routes/payouts.js';
import { createPublishersRouter } from '../../routes/publishers.js';
import { createTrackingRouter } from '../../routes/tracking.js';
import { createCorsMiddleware } from './cors.js';
import { healthRouter } from '../../routes/health.js';
import { notFoundHandler } from './not-found.js';
import { requestContextMiddleware } from './request-context.js';
import { errorHandler } from './error-handler.js';

export function createApp(
  runtime: Pick<
    AppRuntime,
    | 'authService'
    | 'advertiserService'
    | 'conversionService'
    | 'membershipService'
    | 'offerAssignmentService'
    | 'offerService'
    | 'organizationService'
    | 'payoutService'
    | 'publisherService'
    | 'trackingService'
    | 'config'
  >
) {
  const app = express();

  app.disable('x-powered-by');
  app.use(createCorsMiddleware(runtime.config));
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(healthRouter);
  app.use(createAuthRouter(runtime));
  app.use(createAdvertisersRouter(runtime));
  app.use(createConversionsRouter(runtime));
  app.use(createOrganizationsRouter(runtime));
  app.use(createMembershipsRouter(runtime));
  app.use(createOfferAssignmentsRouter(runtime));
  app.use(createOffersRouter(runtime));
  app.use(createPublishersRouter(runtime));
  app.use(createPayoutsRouter(runtime));
  app.use(createTrackingRouter(runtime));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
