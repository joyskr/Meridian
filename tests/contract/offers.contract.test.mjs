import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-offer-contract@example.com');
  const { agent } = await loginAgent(context, 'owner-offer-contract@example.com');
  await createOrganization(agent, 'Offer Contract Agency');

  const advertiser = await agent.post('/advertisers').send({
    name: 'Contract Offer Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const createResponse = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Contract Offer',
    description: 'Contract description',
    tracking_slug: 'contract-offer',
    terms: 'Terms',
    start_at: null,
    end_at: null,
    daily_cap: 5,
    monthly_cap: 50,
    overall_cap: 500,
    event_definitions: [
      {
        event_code: 'sale',
        event_name: 'Sale',
        advertiser_payout: '10.00'
      }
    ]
  });
  assert.equal(createResponse.status, 201);
  assert.deepEqual(Object.keys(createResponse.body).sort(), ['offer']);
  assert.deepEqual(Object.keys(createResponse.body.offer).sort(), [
    'advertiser',
    'archived_at',
    'created_at',
    'daily_cap',
    'description',
    'end_at',
    'event_definitions',
    'id',
    'monthly_cap',
    'name',
    'overall_cap',
    'start_at',
    'status',
    'terms',
    'tracking_slug',
    'updated_at'
  ]);
  assert.deepEqual(Object.keys(createResponse.body.offer.advertiser).sort(), ['id', 'name']);
  assert.deepEqual(Object.keys(createResponse.body.offer.event_definitions[0]).sort(), [
    'advertiser_payout',
    'event_code',
    'event_name',
    'id'
  ]);

  const listResponse = await agent.get('/offers?status=all');
  assert.equal(listResponse.status, 200);
  assert.deepEqual(Object.keys(listResponse.body).sort(), ['offers']);
  assert.deepEqual(Object.keys(listResponse.body.offers[0]).sort(), [
    'advertiser',
    'created_at',
    'event_count',
    'id',
    'name',
    'status',
    'tracking_slug',
    'updated_at'
  ]);

  const detailResponse = await agent.get(`/offers/${createResponse.body.offer.id}`);
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(Object.keys(detailResponse.body).sort(), ['offer']);

  const updateResponse = await agent.patch(`/offers/${createResponse.body.offer.id}`).send({
    description: 'Updated description'
  });
  assert.equal(updateResponse.status, 200);
  assert.deepEqual(Object.keys(updateResponse.body).sort(), ['offer']);

  const activateResponse = await agent.post(`/offers/${createResponse.body.offer.id}/activate`);
  assert.equal(activateResponse.status, 200);
  assert.deepEqual(Object.keys(activateResponse.body).sort(), ['offer']);

  const pauseResponse = await agent.post(`/offers/${createResponse.body.offer.id}/pause`);
  assert.equal(pauseResponse.status, 200);
  assert.deepEqual(Object.keys(pauseResponse.body).sort(), ['offer']);

  const resumeResponse = await agent.post(`/offers/${createResponse.body.offer.id}/resume`);
  assert.equal(resumeResponse.status, 200);
  assert.deepEqual(Object.keys(resumeResponse.body).sort(), ['offer']);

  const archiveResponse = await agent.post(`/offers/${createResponse.body.offer.id}/archive`);
  assert.equal(archiveResponse.status, 200);
  assert.deepEqual(Object.keys(archiveResponse.body).sort(), ['offer']);

  const restoreResponse = await agent.post(`/offers/${createResponse.body.offer.id}/restore`);
  assert.equal(restoreResponse.status, 200);
  assert.deepEqual(Object.keys(restoreResponse.body).sort(), ['offer']);

  const invalidResponse = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: '',
    description: null,
    tracking_slug: 'INVALID SLUG',
    terms: null,
    start_at: null,
    end_at: null,
    daily_cap: null,
    monthly_cap: null,
    overall_cap: null,
    event_definitions: []
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(Object.keys(invalidResponse.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  console.log('offers contract checks passed');
} finally {
  await context.close();
}
