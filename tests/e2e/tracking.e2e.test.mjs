import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-tracking-e2e@example.com');
  const { agent } = await loginAgent(context, 'owner-tracking-e2e@example.com');
  await createOrganization(agent, 'Tracking E2E Agency');

  const advertiser = await agent.post('/advertisers').send({
    name: 'Tracking E2E Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await agent.post('/publishers').send({
    name: 'Tracking E2E Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(publisher.status, 201);

  const offer = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Tracking E2E Offer',
    description: null,
    tracking_slug: 'tracking-e2e-offer',
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
  const activated = await agent.post(`/offers/${offer.body.offer.id}/activate`);
  assert.equal(activated.status, 200);

  const assignment = await agent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/tracking-e2e',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(assignment.status, 201);

  const trackingToken = assignment.body.assignment.tracking_link.tracking_path.split('/').pop();
  const click = await request(context.app).get(`/t/${trackingToken}?sub1=e2e`);
  assert.equal(click.status, 302);
  assert.equal(click.headers.location, 'https://publisher.example/tracking-e2e');

  const clickList = await agent.get('/tracking/clicks');
  assert.equal(clickList.status, 200);
  assert.equal(clickList.body.clicks.length, 1);

  const clickDetail = await agent.get(`/tracking/clicks/${clickList.body.clicks[0].id}`);
  assert.equal(clickDetail.status, 200);
  assert.equal(clickDetail.body.click.offer.id, offer.body.offer.id);
  assert.equal(clickDetail.body.click.publisher.id, publisher.body.publisher.id);
  assert.equal(clickDetail.body.click.advertiser.id, advertiser.body.advertiser.id);
  assert.equal(clickDetail.body.click.request_metadata.attribution.sub1, 'e2e');

  console.log('tracking e2e checks passed');
} finally {
  await context.close();
}
