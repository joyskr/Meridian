import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-publisher-contract@example.com');
  const { agent } = await loginAgent(context, 'owner-publisher-contract@example.com');
  await createOrganization(agent, 'Publisher Contract Agency');

  const createResponse = await agent.post('/publishers').send({
    name: 'Contract Publisher',
    website_url: 'https://contract-publisher.example',
    primary_contact_name: 'Contract Lead',
    primary_contact_email: 'lead@contract-publisher.example',
    notes: 'Contract notes'
  });
  assert.equal(createResponse.status, 201);
  assert.deepEqual(Object.keys(createResponse.body).sort(), ['publisher']);
  assert.deepEqual(Object.keys(createResponse.body.publisher).sort(), [
    'archived_at',
    'created_at',
    'id',
    'name',
    'notes',
    'primary_contact_email',
    'primary_contact_name',
    'publisher_postback_percent',
    'publisher_tier',
    'status',
    'updated_at',
    'website_url'
  ]);

  const listResponse = await agent.get('/publishers?status=all');
  assert.equal(listResponse.status, 200);
  assert.deepEqual(Object.keys(listResponse.body).sort(), ['publishers']);
  assert.deepEqual(Object.keys(listResponse.body.publishers[0]).sort(), [
    'archived_at',
    'created_at',
    'id',
    'name',
    'notes',
    'primary_contact_email',
    'primary_contact_name',
    'publisher_postback_percent',
    'publisher_tier',
    'status',
    'updated_at',
    'website_url'
  ]);

  const tierSettingsResponse = await agent.get('/publisher-tier-settings');
  assert.equal(tierSettingsResponse.status, 200);
  assert.deepEqual(Object.keys(tierSettingsResponse.body).sort(), ['tier_settings']);
  assert.deepEqual(Object.keys(tierSettingsResponse.body.tier_settings).sort(), [
    'tier_1',
    'tier_2',
    'tier_3',
    'tier_4',
    'updated_at'
  ]);

  const detailResponse = await agent.get(`/publishers/${createResponse.body.publisher.id}`);
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(Object.keys(detailResponse.body).sort(), ['publisher']);

  const updateResponse = await agent.patch(`/publishers/${createResponse.body.publisher.id}`).send({
    notes: 'Updated contract notes'
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(Object.keys(updateResponse.body).sort(), ['publisher']);

  const archiveResponse = await agent.post(`/publishers/${createResponse.body.publisher.id}/archive`);
  assert.equal(archiveResponse.status, 200);
  assert.deepEqual(Object.keys(archiveResponse.body).sort(), ['publisher']);

  const restoreResponse = await agent.post(`/publishers/${createResponse.body.publisher.id}/restore`);
  assert.equal(restoreResponse.status, 200);
  assert.deepEqual(Object.keys(restoreResponse.body).sort(), ['publisher']);

  const invalidResponse = await agent.post('/publishers').send({
    name: '',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(Object.keys(invalidResponse.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  console.log('publishers contract checks passed');
} finally {
  await context.close();
}
