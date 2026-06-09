import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-contract-membership@example.com');
  const { agent } = await loginAgent(context, 'owner-contract-membership@example.com');
  const organization = await createOrganization(agent, 'Contract Membership Agency');
  const secondMember = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'viewer-contract-membership@example.com',
    role: 'viewer'
  });
  const managerMember = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-contract-membership@example.com',
    role: 'manager'
  });

  const listResponse = await agent.get('/memberships');
  assert.equal(listResponse.status, 200);
  assert.deepEqual(Object.keys(listResponse.body).sort(), ['memberships']);
  assert.deepEqual(Object.keys(listResponse.body.memberships[0]).sort(), ['current', 'membership', 'user']);
  assert.deepEqual(Object.keys(listResponse.body.memberships[0].membership).sort(), [
    'id',
    'joined_at',
    'manager',
    'role',
    'status'
  ]);
  assert.deepEqual(Object.keys(listResponse.body.memberships[0].user).sort(), [
    'email',
    'email_verified',
    'id'
  ]);

  const detailResponse = await agent.get(`/memberships/${secondMember.membershipId}`);
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(Object.keys(detailResponse.body).sort(), ['current', 'membership', 'user']);
  assert.equal(detailResponse.body.membership.manager, null);

  const updateResponse = await agent.patch(`/memberships/${secondMember.membershipId}/role`).send({
    role: 'analyst'
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(Object.keys(updateResponse.body).sort(), ['current', 'membership', 'user']);

  const invalidResponse = await agent.patch(`/memberships/${secondMember.membershipId}/role`).send({
    role: 'invalid-role'
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(Object.keys(invalidResponse.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  const provisionResponse = await agent.post('/memberships/provision-user').send({
    email: 'provisioned-contract-membership@example.com',
    role: 'viewer',
    manager_membership_id: managerMember.membershipId
  });
  assert.equal(provisionResponse.status, 201);
  assert.deepEqual(Object.keys(provisionResponse.body).sort(), ['membership', 'password_setup', 'user']);
  assert.deepEqual(Object.keys(provisionResponse.body.user).sort(), [
    'created_at',
    'email',
    'email_verified',
    'id'
  ]);
  assert.deepEqual(Object.keys(provisionResponse.body.membership).sort(), [
    'id',
    'joined_at',
    'manager',
    'role',
    'status'
  ]);
  assert.deepEqual(Object.keys(provisionResponse.body.membership.manager).sort(), [
    'email',
    'membership_id',
    'user_id'
  ]);
  assert.deepEqual(Object.keys(provisionResponse.body.password_setup).sort(), [
    'expires_at',
    'required',
    'token'
  ]);

  const assignManagerResponse = await agent
    .patch(`/memberships/${secondMember.membershipId}/manager`)
    .send({
      manager_membership_id: managerMember.membershipId
    });
  assert.equal(assignManagerResponse.status, 200);
  assert.deepEqual(Object.keys(assignManagerResponse.body).sort(), ['current', 'membership', 'user']);
  assert.deepEqual(Object.keys(assignManagerResponse.body.membership.manager).sort(), [
    'email',
    'membership_id',
    'user_id'
  ]);

  const removeManagerResponse = await agent.delete(`/memberships/${secondMember.membershipId}/manager`);
  assert.equal(removeManagerResponse.status, 200);
  assert.equal(removeManagerResponse.body.membership.manager, null);

  console.log('memberships contract checks passed');
} finally {
  await context.close();
}
