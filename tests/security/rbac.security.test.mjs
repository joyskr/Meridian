import request from 'supertest';
import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-security@example.com');
  const { agent: ownerAgent } = await loginAgent(context, 'owner-security@example.com');
  const organization = await createOrganization(ownerAgent, 'Security Agency');

  await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'admin-security@example.com',
    role: 'admin'
  });
  await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-security@example.com',
    role: 'manager'
  });
  const viewerMember = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'viewer-security@example.com',
    role: 'viewer'
  });
  const analystMember = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'analyst-security@example.com',
    role: 'analyst'
  });
  const secondManagerMember = await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-security-second@example.com',
    role: 'manager'
  });

  const { agent: managerAgent } = await loginAgent(context, 'manager-security@example.com');
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organization.organization.id
  });

  const managerListResponse = await managerAgent.get('/memberships');
  assert.equal(managerListResponse.status, 403);
  assert.equal(managerListResponse.body.error.code, 'insufficient_role');

  const managerProvisionResponse = await managerAgent.post('/memberships/provision-user').send({
    email: 'employee-created-by-manager@example.com',
    role: 'viewer',
    manager_membership_id: null
  });
  assert.equal(managerProvisionResponse.status, 403);
  assert.equal(managerProvisionResponse.body.error.code, 'insufficient_role');

  const managerAssignResponse = await managerAgent
    .patch(`/memberships/${viewerMember.membershipId}/manager`)
    .send({
      manager_membership_id: secondManagerMember.membershipId
    });
  assert.equal(managerAssignResponse.status, 403);
  assert.equal(managerAssignResponse.body.error.code, 'insufficient_role');

  const ownerAssignResponse = await ownerAgent
    .patch(`/memberships/${analystMember.membershipId}/manager`)
    .send({
      manager_membership_id: secondManagerMember.membershipId
    });
  assert.equal(ownerAssignResponse.status, 200);

  const managerReassignResponse = await managerAgent
    .patch(`/memberships/${analystMember.membershipId}/manager`)
    .send({
      manager_membership_id: viewerMember.membershipId
    });
  assert.equal(managerReassignResponse.status, 403);
  assert.equal(managerReassignResponse.body.error.code, 'insufficient_role');

  const managerRemoveResponse = await managerAgent.delete(
    `/memberships/${viewerMember.membershipId}/manager`
  );
  assert.equal(managerRemoveResponse.status, 403);
  assert.equal(managerRemoveResponse.body.error.code, 'insufficient_role');

  const { agent: adminAgent } = await loginAgent(context, 'admin-security@example.com');
  await adminAgent.post('/organizations/select-active').send({
    organization_id: organization.organization.id
  });

  const adminPromotionResponse = await adminAgent.patch(`/memberships/${viewerMember.membershipId}/role`).send({
    role: 'admin'
  });
  assert.equal(adminPromotionResponse.status, 403);
  assert.equal(adminPromotionResponse.body.error.code, 'membership_role_change_forbidden');

  const adminDeactivateOwnerResponse = await adminAgent.patch(
    `/memberships/${organization.membership.id}/deactivate`
  );
  assert.equal(adminDeactivateOwnerResponse.status, 403);
  assert.equal(adminDeactivateOwnerResponse.body.error.code, 'membership_deactivation_forbidden');

  const adminProvisionOwnerResponse = await adminAgent.post('/memberships/provision-user').send({
    email: 'owner-created-by-admin@example.com',
    role: 'owner',
    manager_membership_id: null
  });
  assert.equal(adminProvisionOwnerResponse.status, 403);
  assert.equal(adminProvisionOwnerResponse.body.error.code, 'membership_provision_forbidden');

  const selfRoleChangeResponse = await ownerAgent.patch(`/memberships/${organization.membership.id}/role`).send({
    role: 'admin'
  });
  assert.equal(selfRoleChangeResponse.status, 422);
  assert.equal(selfRoleChangeResponse.body.error.code, 'self_membership_mutation_forbidden');

  const selfDeactivateResponse = await ownerAgent.patch(
    `/memberships/${organization.membership.id}/deactivate`
  );
  assert.equal(selfDeactivateResponse.status, 422);
  assert.equal(selfDeactivateResponse.body.error.code, 'self_membership_mutation_forbidden');

  const unauthenticatedProvisionResponse = await request(context.app)
    .post('/memberships/provision-user')
    .send({
      email: 'unauthenticated-created@example.com',
      role: 'viewer',
      manager_membership_id: null
    });
  assert.equal(unauthenticatedProvisionResponse.status, 401);
  assert.equal(unauthenticatedProvisionResponse.body.error.code, 'session_not_found');

  console.log('rbac security checks passed');
} finally {
  await context.close();
}
