import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-tracking-integration@example.com');
  const { agent } = await loginAgent(context, 'owner-tracking-integration@example.com');
  const organization = await createOrganization(agent, 'Tracking Integration Agency');

  const advertiser = await agent.post('/advertisers').send({
    name: 'Tracking Integration Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await agent.post('/publishers').send({
    name: 'Tracking Integration Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(publisher.status, 201);

  const offer = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Tracking Integration Offer',
    description: null,
    tracking_slug: 'tracking-integration-offer',
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

  const activateOffer = await agent.post(`/offers/${offer.body.offer.id}/activate`);
  assert.equal(activateOffer.status, 200);

  const assignment = await agent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/tracking-integration',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(assignment.status, 201);

  const trackingToken = assignment.body.assignment.tracking_link.tracking_path.split('/').pop();
  assert.ok(trackingToken);

  const clickResponse = await request(context.app)
    .get(
      `/t/${trackingToken}?organization_id=forged_org&offer_id=forged_offer&sub1=test-click&utm_source=google&secret=drop-me`
    )
    .set('x-forwarded-for', '198.51.100.20');
  assert.equal(clickResponse.status, 302);
  assert.equal(clickResponse.headers.location, 'https://publisher.example/tracking-integration');

  const clickList = await agent.get('/tracking/clicks');
  assert.equal(clickList.status, 200);
  assert.equal(clickList.body.clicks.length, 1);
  assert.match(clickList.body.clicks[0].id, /^clk_/);
  assert.equal(clickList.body.clicks[0].organization.id, organization.organization.id);
  assert.equal(clickList.body.clicks[0].assignment.id, assignment.body.assignment.id);
  assert.equal(clickList.body.clicks[0].offer.id, offer.body.offer.id);
  assert.equal(clickList.body.clicks[0].publisher.id, publisher.body.publisher.id);
  assert.equal(clickList.body.clicks[0].advertiser.id, advertiser.body.advertiser.id);

  const clickDetail = await agent.get(`/tracking/clicks/${clickList.body.clicks[0].id}`);
  assert.equal(clickDetail.status, 200);
  assert.equal(clickDetail.body.click.tracking_resolution.status, 'accepted');
  assert.equal(
    clickDetail.body.click.tracking_resolution.redirect_url,
    'https://publisher.example/tracking-integration'
  );
  assert.equal(
    typeof clickDetail.body.click.request_metadata.ip_hash,
    'string'
  );
  assert.match(clickDetail.body.click.request_metadata.ip_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(clickDetail.body.click.request_metadata.attribution, {
    sub1: 'test-click',
    sub2: null,
    sub3: null,
    sub4: null,
    sub5: null,
    utm_source: 'google',
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null
  });

  const clickRow = await context.pool.query(
    `SELECT request_ip_hash,
        attribution_sub1,
        attribution_utm_source
     FROM clicks
     WHERE id = $1`,
    [clickList.body.clicks[0].id]
  );
  assert.equal(clickRow.rows[0].request_ip_hash, clickDetail.body.click.request_metadata.ip_hash);
  assert.equal(clickRow.rows[0].attribution_sub1, 'test-click');
  assert.equal(clickRow.rows[0].attribution_utm_source, 'google');

  const retiredColumns = await context.pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'clicks'
       AND column_name IN ('request_ip', 'request_query')`
  );
  assert.equal(retiredColumns.rows.length, 0);

  const paused = await agent.post(`/offer-assignments/${assignment.body.assignment.id}/pause`);
  assert.equal(paused.status, 200);
  const pausedClick = await request(context.app).get(`/t/${trackingToken}`);
  assert.equal(pausedClick.status, 404);
  assert.equal(pausedClick.headers.location, undefined);

  const resumed = await agent.post(`/offer-assignments/${assignment.body.assignment.id}/resume`);
  assert.equal(resumed.status, 200);
  const archived = await agent.post(`/offer-assignments/${assignment.body.assignment.id}/archive`);
  assert.equal(archived.status, 200);
  const archivedClick = await request(context.app).get(`/t/${trackingToken}`);
  assert.equal(archivedClick.status, 404);
  assert.equal(archivedClick.headers.location, undefined);

  console.log('tracking integration checks passed');
} finally {
  await context.close();
}
