import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-tracking-contract@example.com');
  const { agent } = await loginAgent(context, 'owner-tracking-contract@example.com');
  await createOrganization(agent, 'Tracking Contract Agency');

  const advertiser = await agent.post('/advertisers').send({
    name: 'Tracking Contract Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await agent.post('/publishers').send({
    name: 'Tracking Contract Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(publisher.status, 201);

  const offer = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Tracking Contract Offer',
    description: null,
    tracking_slug: null,
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
  await agent.post(`/offers/${offer.body.offer.id}/activate`);

  const assignment = await agent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/tracking-contract',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(assignment.status, 201);
  const trackingToken = assignment.body.assignment.tracking_link.tracking_path.split('/').pop();
  assert.ok(trackingToken);

  const publicResponse = await request(context.app).get(`/t/${trackingToken}`);
  assert.equal(publicResponse.status, 302);
  assert.equal(publicResponse.headers.location, 'https://publisher.example/tracking-contract');

  const clickList = await agent.get('/tracking/clicks');
  assert.equal(clickList.status, 200);
  assert.deepEqual(Object.keys(clickList.body).sort(), ['clicks']);
  assert.deepEqual(Object.keys(clickList.body.clicks[0]).sort(), [
    'advertiser',
    'assignment',
    'clicked_at',
    'id',
    'offer',
    'organization',
    'publisher',
    'tracking_resolution_status'
  ]);

  const clickDetail = await agent.get(`/tracking/clicks/${clickList.body.clicks[0].id}`);
  assert.equal(clickDetail.status, 200);
  assert.deepEqual(Object.keys(clickDetail.body).sort(), ['click']);
  assert.deepEqual(Object.keys(clickDetail.body.click).sort(), [
    'advertiser',
    'assignment',
    'clicked_at',
    'id',
    'offer',
    'organization',
    'publisher',
    'request_metadata',
    'tracking_resolution',
    'tracking_resolution_status'
  ]);
  assert.deepEqual(Object.keys(clickDetail.body.click.request_metadata).sort(), [
    'attribution',
    'ip_hash',
    'referer',
    'request_id',
    'user_agent'
  ]);
  assert.deepEqual(Object.keys(clickDetail.body.click.request_metadata.attribution).sort(), [
    'sub1',
    'sub2',
    'sub3',
    'sub4',
    'sub5',
    'utm_campaign',
    'utm_content',
    'utm_medium',
    'utm_source',
    'utm_term'
  ]);
  assert.deepEqual(Object.keys(clickDetail.body.click.tracking_resolution).sort(), [
    'redirect_url',
    'status'
  ]);

  const malformed = await request(context.app).get('/t/bad!token');
  assert.equal(malformed.status, 400);
  assert.deepEqual(Object.keys(malformed.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  console.log('tracking contract checks passed');
} finally {
  await context.close();
}
