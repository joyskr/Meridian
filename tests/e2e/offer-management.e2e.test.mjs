import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-offer-e2e@example.com');
  const { agent } = await loginAgent(context, 'owner-offer-e2e@example.com');
  await createOrganization(agent, 'Offer E2E Agency');

  const advertiser = await agent.post('/advertisers').send({
    name: 'Offer E2E Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const createResponse = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'E2E Offer',
    description: 'Created in e2e',
    tracking_slug: 'e2e-offer',
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

  const updateResponse = await agent.patch(`/offers/${createResponse.body.offer.id}`).send({
    name: 'E2E Offer Updated'
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.offer.name, 'E2E Offer Updated');

  const activateResponse = await agent.post(`/offers/${createResponse.body.offer.id}/activate`);
  assert.equal(activateResponse.status, 200);
  assert.equal(activateResponse.body.offer.status, 'active');

  const pauseResponse = await agent.post(`/offers/${createResponse.body.offer.id}/pause`);
  assert.equal(pauseResponse.status, 200);
  assert.equal(pauseResponse.body.offer.status, 'paused');

  const resumeResponse = await agent.post(`/offers/${createResponse.body.offer.id}/resume`);
  assert.equal(resumeResponse.status, 200);
  assert.equal(resumeResponse.body.offer.status, 'active');

  const archiveResponse = await agent.post(`/offers/${createResponse.body.offer.id}/archive`);
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.body.offer.status, 'archived');

  const restoreResponse = await agent.post(`/offers/${createResponse.body.offer.id}/restore`);
  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.offer.status, 'draft');

  console.log('offer management e2e checks passed');
} finally {
  await context.close();
}
