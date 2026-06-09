import assert from 'node:assert/strict';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp('owner-offer-unit@example.com', 'Password123!');
  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);
  const login = await context.runtime.authService.login('owner-offer-unit@example.com', 'Password123!');
  const actor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  await context.runtime.organizationService.createOrganization(actor, 'Offer Unit Agency');
  const organizationActor = await context.runtime.membershipService.requireOrganizationActor(
    await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken)
  );

  const advertiser = await context.runtime.advertiserService.createAdvertiser(organizationActor, {
    name: 'Offer Unit Advertiser',
    websiteUrl: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null
  });

  const created = await context.runtime.offerService.createOffer(organizationActor, {
    advertiserId: advertiser.advertiser.id,
    name: 'Growth Sale Offer',
    description: 'Primary offer',
    trackingSlug: 'growth-sale-offer',
    terms: null,
    startAt: null,
    endAt: null,
    dailyCap: null,
    monthlyCap: null,
    overallCap: null,
    eventDefinitions: [
      {
        eventCode: 'sale',
        eventName: 'Sale',
        advertiserPayout: '10.00'
      }
    ]
  });
  assert.equal(created.offer.status, 'draft');
  assert.equal(created.offer.event_definitions.length, 1);

  await assert.rejects(
    () =>
      context.runtime.offerService.createOffer(organizationActor, {
        advertiserId: advertiser.advertiser.id,
        name: ' growth   sale offer ',
        description: null,
        trackingSlug: null,
        terms: null,
        startAt: null,
        endAt: null,
        dailyCap: null,
        monthlyCap: null,
        overallCap: null,
        eventDefinitions: []
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'offer_duplicate_name');
      return true;
    }
  );

  const emptyEvents = await context.runtime.offerService.createOffer(organizationActor, {
    advertiserId: advertiser.advertiser.id,
    name: 'Lead Capture Offer',
    description: null,
    trackingSlug: null,
    terms: null,
    startAt: null,
    endAt: null,
    dailyCap: null,
    monthlyCap: null,
    overallCap: null,
    eventDefinitions: []
  });

  await assert.rejects(
    () => context.runtime.offerService.activateOffer(organizationActor, emptyEvents.offer.id),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'offer_event_definitions_required');
      return true;
    }
  );

  await context.runtime.advertiserService.archiveAdvertiser(organizationActor, advertiser.advertiser.id);

  await assert.rejects(
    () =>
      context.runtime.offerService.createOffer(organizationActor, {
        advertiserId: advertiser.advertiser.id,
        name: 'Archived Advertiser Offer',
        description: null,
        trackingSlug: null,
        terms: null,
        startAt: null,
        endAt: null,
        dailyCap: null,
        monthlyCap: null,
        overallCap: null,
        eventDefinitions: [
          {
            eventCode: 'sale',
            eventName: 'Sale',
            advertiserPayout: '10.00'
          }
        ]
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'advertiser_inactive');
      return true;
    }
  );

  console.log('offer service unit checks passed');
} finally {
  await context.close();
}
