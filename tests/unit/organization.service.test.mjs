import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp('owner@example.com', 'Password123!');
  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);
  const login = await context.runtime.authService.login('owner@example.com', 'Password123!');
  const actor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);

  const created = await context.runtime.organizationService.createOrganization(actor, ' Meridian Alpha ');
  assert.equal(created.organization.name, 'Meridian Alpha');
  assert.equal(created.membership.role, 'owner');

  const currentActor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  const current = await context.runtime.organizationService.getCurrentOrganization(currentActor);
  assert.equal(current.organization?.id, created.organization.id);

  const secondActor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  const createdSecond = await context.runtime.organizationService.createOrganization(secondActor, 'Meridian Beta');

  const listedActor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  const listed = await context.runtime.organizationService.listOrganizations(listedActor);
  assert.equal(listed.organizations.length, 2);
  assert.equal(listed.organizations[0].organization.id, createdSecond.organization.id);
  assert.equal(listed.organizations[0].current, true);

  const selectActor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  const selected = await context.runtime.organizationService.selectActiveOrganization(
    selectActor,
    created.organization.id
  );
  assert.equal(selected.organization.id, created.organization.id);

  console.log('organization service unit checks passed');
} finally {
  await context.close();
}
