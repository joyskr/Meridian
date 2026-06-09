import assert from 'node:assert/strict';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp('owner-advertiser-unit@example.com', 'Password123!');
  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);
  const login = await context.runtime.authService.login('owner-advertiser-unit@example.com', 'Password123!');
  const actor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  await context.runtime.organizationService.createOrganization(actor, 'Advertiser Unit Agency');
  const organizationActor = await context.runtime.membershipService.requireOrganizationActor(
    await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken)
  );

  const created = await context.runtime.advertiserService.createAdvertiser(organizationActor, {
    name: 'Summit Growth Labs',
    websiteUrl: 'https://summit-growth.example',
    primaryContactName: 'Ravi',
    primaryContactEmail: 'ravi@summit-growth.example',
    notes: 'Initial advertiser record'
  });
  assert.equal(created.advertiser.name, 'Summit Growth Labs');
  assert.equal(created.advertiser.status, 'active');

  await assert.rejects(
    () =>
      context.runtime.advertiserService.createAdvertiser(organizationActor, {
        name: ' summit   growth labs ',
        websiteUrl: null,
        primaryContactName: null,
        primaryContactEmail: null,
        notes: null
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'advertiser_duplicate_name');
      return true;
    }
  );

  const archived = await context.runtime.advertiserService.archiveAdvertiser(
    organizationActor,
    created.advertiser.id
  );
  assert.equal(archived.advertiser.status, 'archived');

  const replacement = await context.runtime.advertiserService.createAdvertiser(organizationActor, {
    name: 'Summit Growth Labs',
    websiteUrl: null,
    primaryContactName: null,
    primaryContactEmail: null,
    notes: null
  });
  assert.equal(replacement.advertiser.status, 'active');

  await assert.rejects(
    () => context.runtime.advertiserService.restoreAdvertiser(organizationActor, created.advertiser.id),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'advertiser_duplicate_name');
      return true;
    }
  );

  console.log('advertiser service unit checks passed');
} finally {
  await context.close();
}
