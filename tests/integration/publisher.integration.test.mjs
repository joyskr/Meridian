import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-publisher-integration@example.com');
  const { agent: ownerAgent } = await loginAgent(context, 'owner-publisher-integration@example.com');
  const organization = await createOrganization(ownerAgent, 'Publisher Integration Agency');

  await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-publisher-integration@example.com',
    role: 'manager'
  });

  const { agent: managerAgent } = await loginAgent(context, 'manager-publisher-integration@example.com');
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organization.organization.id
  });

  const createResponse = await managerAgent.post('/publishers').send({
    name: 'Blue Canyon Media',
    website_url: 'https://bluecanyon.example',
    primary_contact_name: 'Neel',
    primary_contact_email: 'neel@bluecanyon.example',
    notes: 'Top of funnel partner'
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.publisher.status, 'active');
  assert.equal(createResponse.body.publisher.publisher_tier, 'tier_1');
  assert.equal(createResponse.body.publisher.publisher_postback_percent, 100);

  const listResponse = await managerAgent.get('/publishers');
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.publishers.length, 1);

  const detailResponse = await managerAgent.get(`/publishers/${createResponse.body.publisher.id}`);
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.publisher.name, 'Blue Canyon Media');

  const updateResponse = await managerAgent.patch(`/publishers/${createResponse.body.publisher.id}`).send({
    name: 'Blue Canyon Growth Media',
    notes: 'Updated notes'
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.publisher.name, 'Blue Canyon Growth Media');

  const managerTierUpdateResponse = await managerAgent.patch(`/publishers/${createResponse.body.publisher.id}`).send({
    publisher_tier: 'tier_3'
  });
  assert.equal(managerTierUpdateResponse.status, 403);
  assert.equal(managerTierUpdateResponse.body.error.code, 'publisher_controls_forbidden');

  const ownerTierUpdateResponse = await ownerAgent.patch(`/publishers/${createResponse.body.publisher.id}`).send({
    publisher_tier: 'tier_3',
    publisher_postback_percent: 45
  });
  assert.equal(ownerTierUpdateResponse.status, 200);
  assert.equal(ownerTierUpdateResponse.body.publisher.publisher_tier, 'tier_3');
  assert.equal(ownerTierUpdateResponse.body.publisher.publisher_postback_percent, 45);

  const tierSettingsResponse = await ownerAgent.get('/publisher-tier-settings');
  assert.equal(tierSettingsResponse.status, 200);
  assert.equal(tierSettingsResponse.body.tier_settings.tier_1, 40);

  const updateTierSettingsResponse = await ownerAgent.patch('/publisher-tier-settings').send({
    tier_1: 41,
    tier_2: 56,
    tier_3: 71,
    tier_4: 81
  });
  assert.equal(updateTierSettingsResponse.status, 200);
  assert.equal(updateTierSettingsResponse.body.tier_settings.tier_4, 81);

  const duplicateResponse = await managerAgent.post('/publishers').send({
    name: ' blue   canyon growth media ',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateResponse.body.error.code, 'publisher_duplicate_name');

  const invalidResponse = await managerAgent.post('/publishers').send({
    name: 'Invalid Website Publisher',
    website_url: 'not-a-url',
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalidResponse.body.error.code, 'validation_failed');

  const archiveResponse = await managerAgent.post(
    `/publishers/${createResponse.body.publisher.id}/archive`
  );
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.body.publisher.status, 'archived');

  const archivedListResponse = await managerAgent.get('/publishers?status=archived');
  assert.equal(archivedListResponse.status, 200);
  assert.equal(archivedListResponse.body.publishers.length, 1);

  const restoreResponse = await managerAgent.post(
    `/publishers/${createResponse.body.publisher.id}/restore`
  );
  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.publisher.status, 'active');

  console.log('publisher integration checks passed');
} finally {
  await context.close();
}
