import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-advertiser-contract@example.com');
  const { agent } = await loginAgent(context, 'owner-advertiser-contract@example.com');
  await createOrganization(agent, 'Advertiser Contract Agency');

  const createResponse = await agent.post('/advertisers').send({
    name: 'Contract Advertiser',
    website_url: 'https://contract-advertiser.example',
    primary_contact_name: 'Contract Lead',
    primary_contact_email: 'lead@contract-advertiser.example',
    notes: 'Contract notes'
  });
  assert.equal(createResponse.status, 201);
  assert.deepEqual(Object.keys(createResponse.body).sort(), ['advertiser']);
  assert.deepEqual(Object.keys(createResponse.body.advertiser).sort(), [
    'archived_at',
    'created_at',
    'id',
    'name',
    'notes',
    'primary_contact_email',
    'primary_contact_name',
    'status',
    'updated_at',
    'website_url'
  ]);

  const listResponse = await agent.get('/advertisers?status=all');
  assert.equal(listResponse.status, 200);
  assert.deepEqual(Object.keys(listResponse.body).sort(), ['advertisers']);
  assert.deepEqual(Object.keys(listResponse.body.advertisers[0]).sort(), [
    'archived_at',
    'created_at',
    'id',
    'name',
    'notes',
    'primary_contact_email',
    'primary_contact_name',
    'status',
    'updated_at',
    'website_url'
  ]);

  const detailResponse = await agent.get(`/advertisers/${createResponse.body.advertiser.id}`);
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(Object.keys(detailResponse.body).sort(), ['advertiser']);

  const updateResponse = await agent.patch(`/advertisers/${createResponse.body.advertiser.id}`).send({
    notes: 'Updated contract notes'
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(Object.keys(updateResponse.body).sort(), ['advertiser']);

  const archiveResponse = await agent.post(`/advertisers/${createResponse.body.advertiser.id}/archive`);
  assert.equal(archiveResponse.status, 200);
  assert.deepEqual(Object.keys(archiveResponse.body).sort(), ['advertiser']);

  const restoreResponse = await agent.post(`/advertisers/${createResponse.body.advertiser.id}/restore`);
  assert.equal(restoreResponse.status, 200);
  assert.deepEqual(Object.keys(restoreResponse.body).sort(), ['advertiser']);

  const invalidResponse = await agent.post('/advertisers').send({
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

  console.log('advertisers contract checks passed');
} finally {
  await context.close();
}
