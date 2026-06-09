import assert from 'node:assert/strict';
import { createAuthTestContext, findUserByEmail, createMembershipSeed } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp('owner-rbac@example.com', 'Password123!');
  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);
  const login = await context.runtime.authService.login('owner-rbac@example.com', 'Password123!');
  const actor = await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken);
  const organization = await context.runtime.organizationService.createOrganization(actor, 'RBAC Agency');

  const secondSignUp = await context.runtime.authService.signUp('member-rbac@example.com', 'Password123!');
  await context.runtime.authService.verifyEmail(secondSignUp.rawChallengeToken);
  const secondUser = await findUserByEmail(context.pool, 'member-rbac@example.com');
  const secondMembershipId = await createMembershipSeed(context.pool, {
    organizationId: organization.organization.id,
    userId: secondUser.id,
    role: 'manager'
  });

  const organizationActor = await context.runtime.membershipService.requireOrganizationActor(
    await context.runtime.authService.getAuthenticatedActor(login.rawSessionToken)
  );

  const listed = await context.runtime.membershipService.listMemberships(organizationActor);
  assert.equal(listed.memberships.length, 2);

  const updated = await context.runtime.membershipService.updateMembershipRole(
    organizationActor,
    secondMembershipId,
    'analyst'
  );
  assert.equal(updated.membership.role, 'analyst');

  const detail = await context.runtime.membershipService.getMembership(
    organizationActor,
    secondMembershipId
  );
  assert.equal(detail.user.email, 'member-rbac@example.com');
  assert.equal(detail.membership.manager, null);

  const managerSignUp = await context.runtime.authService.signUp(
    'manager-unit-phase22@example.com',
    'Password123!'
  );
  await context.runtime.authService.verifyEmail(managerSignUp.rawChallengeToken);
  const managerUser = await findUserByEmail(context.pool, 'manager-unit-phase22@example.com');
  const managerMembershipId = await createMembershipSeed(context.pool, {
    organizationId: organization.organization.id,
    userId: managerUser.id,
    role: 'manager'
  });

  const provisioned = await context.runtime.membershipService.provisionEmployeeAccount(organizationActor, {
    email: 'viewer-unit-phase22@example.com',
    role: 'viewer',
    managerMembershipId
  });
  assert.equal(provisioned.user.email, 'viewer-unit-phase22@example.com');
  assert.equal(provisioned.membership.role, 'viewer');
  assert.equal(provisioned.membership.manager?.membership_id, managerMembershipId);
  assert.equal(provisioned.password_setup.required, true);
  assert.equal(typeof provisioned.password_setup.token, 'string');

  const provisionedMembership = await context.runtime.membershipService.getMembership(
    organizationActor,
    provisioned.membership.id
  );
  assert.equal(provisionedMembership.membership.manager?.membership_id, managerMembershipId);

  const unassigned = await context.runtime.membershipService.removeManager(
    organizationActor,
    provisioned.membership.id
  );
  assert.equal(unassigned.membership.manager, null);

  console.log('membership service unit checks passed');
} finally {
  await context.close();
}
