import assert from 'node:assert/strict';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp('owner-publisher-unit@example.com', 'Password123!');
  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);
  const login = await context.runtime.authService.login('owner-publisher-unit@example.com', 'Password123!');
  const actor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  await context.runtime.organizationService.createOrganization(actor, 'Publisher Unit Agency');
  const organizationActor = await context.runtime.membershipService.requireOrganizationActor(
    await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken)
  );

  const created = await context.runtime.publisherService.createPublisher(organizationActor, {
    name: 'North Ridge Media',
    websiteUrl: 'https://northridge.example',
    primaryContactName: 'Asha',
    primaryContactEmail: 'asha@northridge.example',
    notes: 'Initial publisher record',
    publisherTier: null,
    publisherPostbackPercent: null
  });
  assert.equal(created.publisher.name, 'North Ridge Media');
  assert.equal(created.publisher.status, 'active');
  assert.equal(created.publisher.publisher_tier, 'tier_1');
  assert.equal(created.publisher.publisher_postback_percent, 100);

  await assert.rejects(
    () =>
      context.runtime.publisherService.createPublisher(organizationActor, {
        name: ' north   ridge media ',
        websiteUrl: null,
        primaryContactName: null,
        primaryContactEmail: null,
        notes: null,
        publisherTier: null,
        publisherPostbackPercent: null
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'publisher_duplicate_name');
      return true;
    }
  );

  const archived = await context.runtime.publisherService.archivePublisher(
    organizationActor,
    created.publisher.id
  );
  assert.equal(archived.publisher.status, 'archived');

  const replacement = await context.runtime.publisherService.createPublisher(organizationActor, {
    name: 'North Ridge Media',
    websiteUrl: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null,
    publisherTier: null,
    publisherPostbackPercent: null
  });
  assert.equal(replacement.publisher.status, 'active');

  const tierSettings = await context.runtime.publisherService.getTierSettings(organizationActor);
  assert.equal(tierSettings.tier_settings.tier_1, 40);
  const updatedTierSettings = await context.runtime.publisherService.updateTierSettings(organizationActor, {
    tier_1: 42,
    tier_2: 55,
    tier_3: 70,
    tier_4: 80
  });
  assert.equal(updatedTierSettings.tier_settings.tier_1, 42);

  await assert.rejects(
    () => context.runtime.publisherService.restorePublisher(organizationActor, created.publisher.id),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'publisher_duplicate_name');
      return true;
    }
  );

  console.log('publisher service unit checks passed');
} finally {
  await context.close();
}
