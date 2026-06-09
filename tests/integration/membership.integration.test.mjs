import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-membership@example.com');
  const { agent } = await loginAgent(context, 'owner-membership@example.com');
  const organization = await createOrganization(agent, 'Membership Agency');

  const roleTargetMember = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'analyst-membership@example.com',
    role: 'analyst'
  });
  const primaryManager = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-membership@example.com',
    role: 'manager'
  });
  const alternateManager = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-membership-second@example.com',
    role: 'manager'
  });

  const listResponse = await agent.get('/memberships');
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.memberships.length, 4);

  const detailResponse = await agent.get(`/memberships/${roleTargetMember.membershipId}`);
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.user.email, 'analyst-membership@example.com');

  const roleResponse = await agent.patch(`/memberships/${roleTargetMember.membershipId}/role`).send({
    role: 'viewer'
  });
  assert.equal(roleResponse.status, 200);
  assert.equal(roleResponse.body.membership.role, 'viewer');

  const deactivateResponse = await agent.patch(`/memberships/${roleTargetMember.membershipId}/deactivate`);
  assert.equal(deactivateResponse.status, 200);
  assert.equal(deactivateResponse.body.membership.status, 'deactivated');

  const updatedListResponse = await agent.get('/memberships');
  assert.equal(updatedListResponse.status, 200);
  const updatedMembership = updatedListResponse.body.memberships.find(
    (membership) => membership.membership.id === roleTargetMember.membershipId
  );
  assert.equal(updatedMembership.membership.status, 'deactivated');

  const provisionResponse = await agent.post('/memberships/provision-user').send({
    email: 'viewer-provisioned@example.com',
    role: 'viewer',
    manager_membership_id: primaryManager.membershipId
  });
  assert.equal(provisionResponse.status, 201);
  assert.equal(provisionResponse.body.user.email, 'viewer-provisioned@example.com');
  assert.equal(provisionResponse.body.membership.role, 'viewer');
  assert.equal(
    provisionResponse.body.membership.manager.membership_id,
    primaryManager.membershipId
  );
  assert.equal(provisionResponse.body.password_setup.required, true);
  assert.equal(typeof provisionResponse.body.password_setup.token, 'string');

  const passwordResetResponse = await agent.post('/auth/password-reset/reset').send({
    token: provisionResponse.body.password_setup.token,
    password: 'Password456!'
  });
  assert.equal(passwordResetResponse.status, 200);
  assert.equal(passwordResetResponse.body.user.email, 'viewer-provisioned@example.com');

  const { agent: provisionedAgent, loginResponse } = await loginAgent(
    context,
    'viewer-provisioned@example.com',
    'Password456!'
  );
  assert.equal(loginResponse.status, 200);

  const organizationsResponse = await provisionedAgent.get('/organizations');
  assert.equal(organizationsResponse.status, 200);
  assert.equal(organizationsResponse.body.organizations.length, 1);

  const assignManagerResponse = await agent
    .patch(`/memberships/${provisionResponse.body.membership.id}/manager`)
    .send({
      manager_membership_id: alternateManager.membershipId
    });
  assert.equal(assignManagerResponse.status, 200);
  assert.equal(
    assignManagerResponse.body.membership.manager.membership_id,
    alternateManager.membershipId
  );

  const removeManagerResponse = await agent.delete(
    `/memberships/${provisionResponse.body.membership.id}/manager`
  );
  assert.equal(removeManagerResponse.status, 200);
  assert.equal(removeManagerResponse.body.membership.manager, null);

  console.log('membership integration checks passed');
} finally {
  await context.close();
}
