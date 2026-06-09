import assert from 'node:assert/strict';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp(
    'owner-offer-assignment-unit@example.com',
    'Password123!'
  );
  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);
  const login = await context.runtime.authService.login(
    'owner-offer-assignment-unit@example.com',
    'Password123!'
  );
  const actor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  await context.runtime.organizationService.createOrganization(actor, 'Offer Assignment Unit Agency');
  const organizationActor = await context.runtime.membershipService.requireOrganizationActor(
    await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken)
  );

  const advertiser = await context.runtime.advertiserService.createAdvertiser(organizationActor, {
    name: 'Assignment Unit Advertiser',
    websiteUrl: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null
  });
  const publisher = await context.runtime.publisherService.createPublisher(organizationActor, {
    name: 'Assignment Unit Publisher',
    websiteUrl: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null,
    publisherTier: 'tier_2',
    publisherPostbackPercent: 50
  });
  const offer = await context.runtime.offerService.createOffer(organizationActor, {
    advertiserId: advertiser.advertiser.id,
    name: 'Assignment Unit Offer',
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
  });

  const created = await context.runtime.offerAssignmentService.createAssignment(organizationActor, {
    offerId: offer.offer.id,
    publisherId: publisher.publisher.id,
    redirectUrl: 'https://publisher.example/assignment-unit',
    conversionVisibilityPercent: 70,
    postbackPercent: 80,
    payoutOverrides: [
      {
        eventCode: 'sale',
        publisherPayoutAmount: '9.00'
      }
    ]
  });
  assert.equal(created.assignment.status, 'active');
  assert.equal(created.assignment.effective_postback_percent, 50);

  await assert.rejects(
    () =>
      context.runtime.offerAssignmentService.createAssignment(organizationActor, {
        offerId: offer.offer.id,
        publisherId: publisher.publisher.id,
        redirectUrl: 'https://publisher.example/duplicate',
        conversionVisibilityPercent: null,
        postbackPercent: null,
        payoutOverrides: []
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'offer_assignment_duplicate_pair');
      return true;
    }
  );

  await assert.rejects(
    () =>
      context.runtime.offerAssignmentService.createAssignment(organizationActor, {
        offerId: offer.offer.id,
        publisherId: publisher.publisher.id,
        redirectUrl: 'https://publisher.example/unknown-event',
        conversionVisibilityPercent: 100,
        postbackPercent: 100,
        payoutOverrides: [
          {
            eventCode: 'unknown_event',
            publisherPayoutAmount: '5.00'
          }
        ]
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'offer_assignment_duplicate_pair');
      return true;
    }
  );

  await assert.rejects(
    () =>
      context.runtime.offerAssignmentService.updateAssignment(organizationActor, created.assignment.id, {
        payoutOverrides: [
          {
            eventCode: 'unknown_event',
            publisherPayoutAmount: '5.00'
          }
        ]
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'offer_assignment_override_event_not_found');
      return true;
    }
  );

  console.log('offer assignment service unit checks passed');
} finally {
  await context.close();
}
