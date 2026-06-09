import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp(
    'owner-tracking-unit@example.com',
    'Password123!'
  );
  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);
  const login = await context.runtime.authService.login(
    'owner-tracking-unit@example.com',
    'Password123!'
  );
  const actor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  await context.runtime.organizationService.createOrganization(actor, 'Tracking Unit Agency');
  const organizationActor = await context.runtime.membershipService.requireOrganizationActor(
    await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken)
  );

  const advertiser = await context.runtime.advertiserService.createAdvertiser(organizationActor, {
    name: 'Tracking Unit Advertiser',
    websiteUrl: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null
  });
  const publisher = await context.runtime.publisherService.createPublisher(organizationActor, {
    name: 'Tracking Unit Publisher',
    websiteUrl: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null,
    publisherTier: 'tier_1',
    publisherPostbackPercent: 100
  });
  const offer = await context.runtime.offerService.createOffer(organizationActor, {
    advertiserId: advertiser.advertiser.id,
    name: 'Tracking Unit Offer',
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
  await context.runtime.offerService.activateOffer(organizationActor, offer.offer.id);

  const assignment = await context.runtime.offerAssignmentService.createAssignment(organizationActor, {
    offerId: offer.offer.id,
    publisherId: publisher.publisher.id,
    redirectUrl: 'https://publisher.example/tracking-unit',
    conversionVisibilityPercent: 100,
    postbackPercent: 100,
    payoutOverrides: []
  });
  const trackingToken = assignment.assignment.tracking_link.tracking_path.split('/').pop();
  assert.ok(trackingToken);

  const result = await context.runtime.trackingService.ingestClick(trackingToken, {
    attribution: {
      sub1: 'unit-test',
      sub2: null,
      sub3: null,
      sub4: null,
      sub5: null,
      utm_source: 'newsletter',
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null
    },
    ipAddress: '127.0.0.1',
    userAgent: 'tracking-unit-test',
    referer: 'https://example.test/ref',
    requestId: 'req-unit-tracking'
  });

  assert.match(result.click.id, /^clk_/);
  assert.equal(result.redirectUrl, 'https://publisher.example/tracking-unit');
  assert.equal(result.click.organization_id, organizationActor.organizationId);
  assert.equal(result.click.offer_assignment_id, assignment.assignment.id);
  assert.equal(result.click.offer_id, offer.offer.id);
  assert.equal(result.click.publisher_id, publisher.publisher.id);
  assert.equal(result.click.advertiser_id, advertiser.advertiser.id);
  assert.equal(
    result.click.request_ip_hash,
    createHash('sha256')
      .update('test-session-secret-1234:127.0.0.1')
      .digest('hex')
  );
  assert.equal(result.click.attribution_sub1, 'unit-test');
  assert.equal(result.click.attribution_utm_source, 'newsletter');

  await context.runtime.offerAssignmentService.pauseAssignment(organizationActor, assignment.assignment.id);

  await assert.rejects(
    () =>
      context.runtime.trackingService.ingestClick(trackingToken, {
        attribution: {
          sub1: null,
          sub2: null,
          sub3: null,
          sub4: null,
          sub5: null,
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          utm_term: null
        },
        ipAddress: null,
        userAgent: null,
        referer: null,
        requestId: null
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'tracking_unavailable');
      return true;
    }
  );

  await assert.rejects(
    () =>
      context.runtime.trackingService.ingestClick('bad!token', {
        attribution: {
          sub1: null,
          sub2: null,
          sub3: null,
          sub4: null,
          sub5: null,
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          utm_term: null
        },
        ipAddress: null,
        userAgent: null,
        referer: null,
        requestId: null
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'tracking_token_invalid');
      return true;
    }
  );

  console.log('tracking service unit checks passed');
} finally {
  await context.close();
}
