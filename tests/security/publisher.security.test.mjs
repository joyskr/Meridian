import request from 'supertest';
import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-publisher-security-a@example.com');
  const { agent: ownerAgentA } = await loginAgent(context, 'owner-publisher-security-a@example.com');
  const organizationA = await createOrganization(ownerAgentA, 'Publisher Security Agency A');

  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'viewer-publisher-security@example.com',
    role: 'viewer'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'manager-publisher-security@example.com',
    role: 'manager'
  });

  const createResponse = await ownerAgentA.post('/publishers').send({
    name: 'Tenant A Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(createResponse.status, 201);
  const publisherId = createResponse.body.publisher.id;

  const { agent: viewerAgent } = await loginAgent(context, 'viewer-publisher-security@example.com');
  await viewerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const viewerCreateResponse = await viewerAgent.post('/publishers').send({
    name: 'Viewer Forbidden Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(viewerCreateResponse.status, 403);
  assert.equal(viewerCreateResponse.body.error.code, 'publisher_write_forbidden');

  const viewerUpdateResponse = await viewerAgent.patch(`/publishers/${publisherId}`).send({
    notes: 'No access'
  });
  assert.equal(viewerUpdateResponse.status, 403);
  assert.equal(viewerUpdateResponse.body.error.code, 'publisher_write_forbidden');

  const viewerArchiveResponse = await viewerAgent.post(`/publishers/${publisherId}/archive`);
  assert.equal(viewerArchiveResponse.status, 403);
  assert.equal(viewerArchiveResponse.body.error.code, 'publisher_write_forbidden');

  const viewerRestoreResponse = await viewerAgent.post(`/publishers/${publisherId}/restore`);
  assert.equal(viewerRestoreResponse.status, 403);
  assert.equal(viewerRestoreResponse.body.error.code, 'publisher_write_forbidden');

  const viewerTierSettingsResponse = await viewerAgent.get('/publisher-tier-settings');
  assert.equal(viewerTierSettingsResponse.status, 403);
  assert.equal(viewerTierSettingsResponse.body.error.code, 'publisher_controls_forbidden');

  const { agent: managerAgent } = await loginAgent(context, 'manager-publisher-security@example.com');
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const managerControlUpdate = await managerAgent.patch(`/publishers/${publisherId}`).send({
    publisher_postback_percent: 25
  });
  assert.equal(managerControlUpdate.status, 403);
  assert.equal(managerControlUpdate.body.error.code, 'publisher_controls_forbidden');

  const managerTierSettingsResponse = await managerAgent.get('/publisher-tier-settings');
  assert.equal(managerTierSettingsResponse.status, 403);
  assert.equal(managerTierSettingsResponse.body.error.code, 'publisher_controls_forbidden');

  await createVerifiedUser(context, 'owner-publisher-security-b@example.com');
  const { agent: ownerAgentB } = await loginAgent(context, 'owner-publisher-security-b@example.com');
  const organizationB = await createOrganization(ownerAgentB, 'Publisher Security Agency B');
  await ownerAgentB.post('/organizations/select-active').send({
    organization_id: organizationB.organization.id
  });

  const crossTenantReadResponse = await ownerAgentB.get(`/publishers/${publisherId}`);
  assert.equal(crossTenantReadResponse.status, 404);
  assert.equal(crossTenantReadResponse.body.error.code, 'publisher_not_found');

  const crossTenantUpdateResponse = await ownerAgentB.patch(`/publishers/${publisherId}`).send({
    notes: 'Cross-tenant mutation'
  });
  assert.equal(crossTenantUpdateResponse.status, 404);
  assert.equal(crossTenantUpdateResponse.body.error.code, 'publisher_not_found');

  const crossTenantArchiveResponse = await ownerAgentB.post(`/publishers/${publisherId}/archive`);
  assert.equal(crossTenantArchiveResponse.status, 404);
  assert.equal(crossTenantArchiveResponse.body.error.code, 'publisher_not_found');

  const crossTenantRestoreResponse = await ownerAgentB.post(`/publishers/${publisherId}/restore`);
  assert.equal(crossTenantRestoreResponse.status, 404);
  assert.equal(crossTenantRestoreResponse.body.error.code, 'publisher_not_found');

  const unauthenticatedListResponse = await request(context.app).get('/publishers');
  assert.equal(unauthenticatedListResponse.status, 401);
  assert.equal(unauthenticatedListResponse.body.error.code, 'session_not_found');

  console.log('publisher security checks passed');
} finally {
  await context.close();
}
