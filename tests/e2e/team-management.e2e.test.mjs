import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-e2e-team@example.com');
  const { agent } = await loginAgent(context, 'owner-e2e-team@example.com');
  const organization = await createOrganization(agent, 'E2E Team Agency');
  const member = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'member-e2e-team@example.com',
    role: 'viewer'
  });

  const listResponse = await agent.get('/memberships');
  assert.equal(listResponse.status, 200);

  const roleResponse = await agent.patch(`/memberships/${member.membershipId}/role`).send({
    role: 'manager'
  });
  assert.equal(roleResponse.status, 200);
  assert.equal(roleResponse.body.membership.role, 'manager');

  const deactivateResponse = await agent.patch(`/memberships/${member.membershipId}/deactivate`);
  assert.equal(deactivateResponse.status, 200);
  assert.equal(deactivateResponse.body.membership.status, 'deactivated');

  console.log('team management e2e checks passed');
} finally {
  await context.close();
}
