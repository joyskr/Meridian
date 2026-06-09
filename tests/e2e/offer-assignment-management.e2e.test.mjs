import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-offer-assignment-e2e@example.com');
  const { agent } = await loginAgent(context, 'owner-offer-assignment-e2e@example.com');
  await createOrganization(agent, 'Offer Assignment E2E Agency');

  const advertiser = await agent.post('/advertisers').send({
    name: 'Offer Assignment E2E Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await agent.post('/publishers').send({
    name: 'Offer Assignment E2E Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null,
    publisher_tier: 'tier_3',
    publisher_postback_percent: 75
  });
  assert.equal(publisher.status, 201);

  const offer = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Offer Assignment E2E Offer',
    description: null,
    tracking_slug: 'offer-assignment-e2e-offer',
    terms: null,
    start_at: null,
    end_at: null,
    daily_cap: null,
    monthly_cap: null,
    overall_cap: null,
    event_definitions: [
      {
        event_code: 'sale',
        event_name: 'Sale',
        advertiser_payout: '10.00'
      }
    ]
  });
  assert.equal(offer.status, 201);

  const createResponse = await agent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/e2e-assignment',
    conversion_visibility_percent: 65,
    postback_percent: 80,
    payout_overrides: [
      {
        event_code: 'sale',
        publisher_payout_amount: '8.75'
      }
    ]
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.assignment.effective_postback_percent, 75);

  const updateResponse = await agent.patch(`/offer-assignments/${createResponse.body.assignment.id}`).send({
    conversion_visibility_percent: 55,
    postback_percent: 70
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.assignment.effective_postback_percent, 70);

  const pauseResponse = await agent.post(`/offer-assignments/${createResponse.body.assignment.id}/pause`);
  assert.equal(pauseResponse.status, 200);
  assert.equal(pauseResponse.body.assignment.status, 'paused');

  const resumeResponse = await agent.post(`/offer-assignments/${createResponse.body.assignment.id}/resume`);
  assert.equal(resumeResponse.status, 200);
  assert.equal(resumeResponse.body.assignment.status, 'active');

  const archiveResponse = await agent.post(`/offer-assignments/${createResponse.body.assignment.id}/archive`);
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.body.assignment.status, 'archived');

  const restoreResponse = await agent.post(`/offer-assignments/${createResponse.body.assignment.id}/restore`);
  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.assignment.status, 'paused');

  console.log('offer assignment management e2e checks passed');
} finally {
  await context.close();
}
