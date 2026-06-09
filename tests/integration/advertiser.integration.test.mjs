import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-advertiser-integration@example.com');
  const { agent: ownerAgent } = await loginAgent(context, 'owner-advertiser-integration@example.com');
  const organization = await createOrganization(ownerAgent, 'Advertiser Integration Agency');

  await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-advertiser-integration@example.com',
    role: 'manager'
  });

  const { agent: managerAgent } = await loginAgent(context, 'manager-advertiser-integration@example.com');
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organization.organization.id
  });

  const createResponse = await managerAgent.post('/advertisers').send({
    name: 'Orbit Launch Media',
    website_url: 'https://orbit-launch.example',
    primary_contact_name: 'Mina',
    primary_contact_email: 'mina@orbit-launch.example',
    notes: 'Top advertiser account'
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.advertiser.status, 'active');

  const listResponse = await managerAgent.get('/advertisers');
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.advertisers.length, 1);

  const detailResponse = await managerAgent.get(`/advertisers/${createResponse.body.advertiser.id}`);
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.advertiser.name, 'Orbit Launch Media');

  const updateResponse = await managerAgent.patch(`/advertisers/${createResponse.body.advertiser.id}`).send({
    name: 'Orbit Launch Growth',
    notes: 'Updated advertiser notes'
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.advertiser.name, 'Orbit Launch Growth');

  const duplicateResponse = await managerAgent.post('/advertisers').send({
    name: ' orbit   launch growth ',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateResponse.body.error.code, 'advertiser_duplicate_name');

  const invalidResponse = await managerAgent.post('/advertisers').send({
    name: 'Invalid Website Advertiser',
    website_url: 'not-a-url',
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.error.code, 'validation_failed');

  const archiveResponse = await managerAgent.post(
    `/advertisers/${createResponse.body.advertiser.id}/archive`
  );
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.body.advertiser.status, 'archived');

  const archivedListResponse = await managerAgent.get('/advertisers?status=archived');
  assert.equal(archivedListResponse.status, 200);
  assert.equal(archivedListResponse.body.advertisers.length, 1);

  const restoreResponse = await managerAgent.post(
    `/advertisers/${createResponse.body.advertiser.id}/restore`
  );
  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.advertiser.status, 'active');

  console.log('advertiser integration checks passed');
} finally {
  await context.close();
}
