import type { Pool } from 'pg';
import { readRuntimeConfig, type RuntimeConfig } from './platform/config/env.js';
import { createDatabase } from './platform/database/database.js';
import { createPool } from './platform/database/create-pool.js';
import { runMigrations } from './platform/database/migrate.js';
import { AuthRepository } from './modules/auth/auth-repository.js';
import { AuthService } from './modules/auth/auth-service.js';
import { AdvertiserRepository } from './modules/advertisers/advertiser-repository.js';
import { AdvertiserService } from './modules/advertisers/advertiser-service.js';
import { ConversionRepository } from './modules/conversions/conversion-repository.js';
import { ConversionService } from './modules/conversions/conversion-service.js';
import { MembershipRepository } from './modules/memberships/membership-repository.js';
import { MembershipService } from './modules/memberships/membership-service.js';
import { OfferAssignmentRepository } from './modules/offer-assignments/offer-assignment-repository.js';
import { OfferAssignmentService } from './modules/offer-assignments/offer-assignment-service.js';
import { OfferRepository } from './modules/offers/offer-repository.js';
import { OfferService } from './modules/offers/offer-service.js';
import { OrganizationRepository } from './modules/organizations/organization-repository.js';
import { OrganizationService } from './modules/organizations/organization-service.js';
import { PublisherRepository } from './modules/publishers/publisher-repository.js';
import { PublisherService } from './modules/publishers/publisher-service.js';
import { PayoutRepository } from './modules/payouts/payout-repository.js';
import { PayoutService } from './modules/payouts/payout-service.js';
import { TrackingRepository } from './modules/tracking/tracking-repository.js';
import { TrackingService } from './modules/tracking/tracking-service.js';

export type AppRuntime = {
  authService: AuthService;
  advertiserService: AdvertiserService;
  conversionService: ConversionService;
  membershipService: MembershipService;
  offerAssignmentService: OfferAssignmentService;
  offerService: OfferService;
  organizationService: OrganizationService;
  payoutService: PayoutService;
  publisherService: PublisherService;
  trackingService: TrackingService;
  config: RuntimeConfig;
  close(): Promise<void>;
};

export async function createRuntime(options: {
  pool?: Pool;
  configOverrides?: Partial<Record<string, unknown>>;
  skipMigrations?: boolean;
} = {}) {
  const config = readRuntimeConfig(options.configOverrides);
  const pool = options.pool ?? createPool(config);
  const database = createDatabase(pool);

  if (!options.skipMigrations) {
    await runMigrations(database);
  }

  const authRepository = new AuthRepository(database);
  const authService = new AuthService(authRepository, config);
  const advertiserRepository = new AdvertiserRepository(database);
  const advertiserService = new AdvertiserService(advertiserRepository);
  const conversionRepository = new ConversionRepository(database);
  const conversionService = new ConversionService(conversionRepository);
  const membershipRepository = new MembershipRepository(database);
  const membershipService = new MembershipService(membershipRepository, config);
  const offerAssignmentRepository = new OfferAssignmentRepository(database);
  const offerAssignmentService = new OfferAssignmentService(offerAssignmentRepository);
  const offerRepository = new OfferRepository(database);
  const offerService = new OfferService(offerRepository);
  const organizationRepository = new OrganizationRepository(database);
  const organizationService = new OrganizationService(organizationRepository);
  const payoutRepository = new PayoutRepository(database);
  const payoutService = new PayoutService(payoutRepository);
  const publisherRepository = new PublisherRepository(database);
  const publisherService = new PublisherService(publisherRepository);
  const trackingRepository = new TrackingRepository(database);
  const trackingService = new TrackingService(trackingRepository, config);

  return {
    authService,
    advertiserService,
    conversionService,
    membershipService,
    offerAssignmentService,
    offerService,
    organizationService,
    payoutService,
    publisherService,
    trackingService,
    config,
    async close() {
      await database.close();
    }
  } satisfies AppRuntime;
}
