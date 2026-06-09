import request from 'supertest';
import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-advertiser-security-a@example.com');
  const { agent: ownerAgentA } = await loginAgent(context, 'owner-advertiser-security-a@example.com');
  const organizationA = await createOrganization(ownerAgentA, 'Advertiser Security Agency A');

  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'viewer-advertiser-security@example.com',
    role: 'viewer'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'manager-advertiser-security@example.com',
    role: 'manager'
  });

  const createResponse = await ownerAgentA.post('/advertisers').send({
    name: 'Tenant A Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(createResponse.status, 201);
  const advertiserId = createResponse.body.advertiser.id;

  const { agent: viewerAgent } = await loginAgent(context, 'viewer-advertiser-security@example.com');
  await viewerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const viewerCreateResponse = await viewerAgent.post('/advertisers').send({
    name: 'Viewer Forbidden Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(viewerCreateResponse.status, 403);
  assert.equal(viewerCreateResponse.body.error.code, 'advertiser_write_forbidden');

  const viewerUpdateResponse = await viewerAgent.patch(`/advertisers/${advertiserId}`).send({
    notes: 'No access'
  });
  assert.equal(viewerUpdateResponse.status, 403);
  assert.equal(viewerUpdateResponse.body.error.code, 'advertiser_write_forbidden');

  const viewerArchiveResponse = await viewerAgent.post(`/advertisers/${advertiserId}/archive`);
  assert.equal(viewerArchiveResponse.status, 403);
  assert.equal(viewerArchiveResponse.body.error.code, 'advertiser_write_forbidden');

  const viewerRestoreResponse = await viewerAgent.post(`/advertisers/${advertiserId}/restore`);
  assert.equal(viewerRestoreResponse.status, 403);
  assert.equal(viewerRestoreResponse.body.error.code, 'advertiser_write_forbidden');

  await createVerifiedUser(context, 'owner-advertiser-security-b@example.com');
  const { agent: ownerAgentB } = await loginAgent(context, 'owner-advertiser-security-b@example.com');
  const organizationB = await createOrganization(ownerAgentB, 'Advertiser Security Agency B');
  await ownerAgentB.post('/organizations/select-active').send({
    organization_id: organizationB.organization.id
  });

  const crossTenantReadResponse = await ownerAgentB.get(`/advertisers/${advertiserId}`);
  assert.equal(crossTenantReadResponse.status, 404);
  assert.equal(crossTenantReadResponse.body.error.code, 'advertiser_not_found');

  const crossTenantUpdateResponse = await ownerAgentB.patch(`/advertisers/${advertiserId}`).send({
    notes: 'Cross-tenant mutation'
  });
  assert.equal(crossTenantUpdateResponse.status, 404);
  assert.equal(crossTenantUpdateResponse.body.error.code, 'advertiser_not_found');

  const crossTenantArchiveResponse = await ownerAgentB.post(`/advertisers/${advertiserId}/archive`);
  assert.equal(crossTenantArchiveResponse.status, 404);
  assert.equal(crossTenantArchiveResponse.body.error.code, 'advertiser_not_found');

  const crossTenantRestoreResponse = await ownerAgentB.post(`/advertisers/${advertiserId}/restore`);
  assert.equal(crossTenantRestoreResponse.status, 404);
  assert.equal(crossTenantRestoreResponse.body.error.code, 'advertiser_not_found');

  const unauthenticatedListResponse = await request(context.app).get('/advertisers');
  assert.equal(unauthenticatedListResponse.status, 401);
  assert.equal(unauthenticatedListResponse.body.error.code, 'session_not_found');

  console.log('advertiser security checks passed');
} finally {
  await context.close();
}
