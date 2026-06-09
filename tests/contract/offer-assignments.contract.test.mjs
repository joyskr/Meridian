import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-offer-assignment-contract@example.com');
  const { agent } = await loginAgent(context, 'owner-offer-assignment-contract@example.com');
  await createOrganization(agent, 'Offer Assignment Contract Agency');

  const advertiser = await agent.post('/advertisers').send({
    name: 'Contract Assignment Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await agent.post('/publishers').send({
    name: 'Contract Assignment Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(publisher.status, 201);

  const offer = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Contract Assignment Offer',
    description: null,
    tracking_slug: 'contract-assignment-offer',
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
    redirect_url: 'https://publisher.example/contract-assignment',
    conversion_visibility_percent: 80,
    postback_percent: 60,
    payout_overrides: [
      {
        event_code: 'sale',
        publisher_payout_amount: '8.50'
      }
    ]
  });
  assert.equal(createResponse.status, 201);
  assert.deepEqual(Object.keys(createResponse.body).sort(), ['assignment']);
  assert.deepEqual(Object.keys(createResponse.body.assignment).sort(), [
    'archived_at',
    'conversion_visibility_percent',
    'created_at',
    'effective_postback_percent',
    'id',
    'offer',
    'payout_overrides',
    'postback_percent',
    'publisher',
    'redirect_url',
    'status',
    'tracking_link',
    'updated_at'
  ]);

  const listResponse = await agent.get('/offer-assignments?status=all');
  assert.equal(listResponse.status, 200);
  assert.deepEqual(Object.keys(listResponse.body).sort(), ['assignments']);
  assert.deepEqual(Object.keys(listResponse.body.assignments[0]).sort(), [
    'conversion_visibility_percent',
    'created_at',
    'effective_postback_percent',
    'id',
    'offer',
    'payout_override_count',
    'postback_percent',
    'publisher',
    'redirect_url',
    'status',
    'updated_at'
  ]);

  const detailResponse = await agent.get(`/offer-assignments/${createResponse.body.assignment.id}`);
  assert.equal(detailResponse.status, 200);

  const updateResponse = await agent.patch(`/offer-assignments/${createResponse.body.assignment.id}`).send({
    conversion_visibility_percent: 70
  });
  assert.equal(updateResponse.status, 200);

  const trackingLinkResponse = await agent.get(
    `/offer-assignments/${createResponse.body.assignment.id}/tracking-link`
  );
  assert.equal(trackingLinkResponse.status, 200);
  assert.deepEqual(Object.keys(trackingLinkResponse.body.tracking_link).sort(), [
    'assignment_id',
    'tracking_path'
  ]);

  const invalidResponse = await agent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/invalid-assignment',
    conversion_visibility_percent: 101,
    postback_percent: 60,
    payout_overrides: []
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(Object.keys(invalidResponse.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  console.log('offer assignments contract checks passed');
} finally {
  await context.close();
}
