import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import { createTrackedConversionFixture } from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-conversion-contract@example.com');
  const { agent } = await loginAgent(context, 'owner-conversion-contract@example.com');
  await createOrganization(agent, 'Conversion Contract Agency');

  const fixture = await createTrackedConversionFixture(context, agent, {
    advertiserName: 'Conversion Contract Advertiser',
    publisherName: 'Conversion Contract Publisher',
    offerName: 'Conversion Contract Offer',
    trackingSlug: 'conversion-contract-offer',
    redirectUrl: 'https://publisher.example/conversion-contract'
  });

  const ingest = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'sale',
    external_event_id: 'evt-contract-1',
    click_id: fixture.click.id
  });
  assert.equal(ingest.status, 202);
  assert.deepEqual(Object.keys(ingest.body).sort(), ['conversion', 'outcome']);
  assert.deepEqual(Object.keys(ingest.body.conversion).sort(), [
    'advertiser_id',
    'click_id',
    'event_type',
    'external_event_id',
    'finalized_at',
    'id',
    'idempotency_key',
    'occurred_at',
    'offer_assignment_id',
    'offer_id',
    'publisher_id',
    'received_at',
    'rejection_reason',
    'source_surface',
    'status'
  ]);

  const list = await agent.get('/conversions');
  assert.equal(list.status, 200);
  assert.deepEqual(Object.keys(list.body).sort(), ['conversions']);
  assert.deepEqual(Object.keys(list.body.conversions[0]).sort(), [
    'advertiser',
    'assignment',
    'click',
    'event_type',
    'finalized_at',
    'id',
    'occurred_at',
    'offer',
    'publisher',
    'received_at',
    'rejection_reason',
    'source_surface',
    'status'
  ]);

  const detail = await agent.get(`/conversions/${ingest.body.conversion.id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual(Object.keys(detail.body).sort(), ['conversion']);
  assert.deepEqual(Object.keys(detail.body.conversion).sort(), [
    'advertiser',
    'assignment',
    'click',
    'event_type',
    'external_event_id',
    'finalized_at',
    'financial_snapshot',
    'id',
    'idempotency_key',
    'lookup_inputs',
    'occurred_at',
    'offer',
    'postback_snapshot',
    'publisher',
    'received_at',
    'rejection_reason',
    'source_surface',
    'status',
    'visibility_snapshot'
  ]);
  assert.deepEqual(Object.keys(detail.body.conversion.lookup_inputs).sort(), [
    'click_id',
    'sub1',
    'sub2',
    'sub3',
    'sub4',
    'sub5'
  ]);
  assert.deepEqual(Object.keys(detail.body.conversion.financial_snapshot).sort(), [
    'advertiser_payout',
    'assignment_override_amount',
    'publisher_payout',
    'publisher_payout_source',
    'publisher_tier',
    'publisher_tier_percent'
  ]);
  assert.deepEqual(Object.keys(detail.body.conversion.visibility_snapshot).sort(), [
    'conversion_visibility_percent',
    'conversion_visible_to_publisher'
  ]);
  assert.deepEqual(Object.keys(detail.body.conversion.postback_snapshot).sort(), [
    'assignment_postback_percent',
    'effective_postback_percent',
    'postback_eligible',
    'publisher_postback_percent'
  ]);

  const reprocess = await agent.post(`/conversions/${ingest.body.conversion.id}/reprocess`);
  assert.equal(reprocess.status, 200);
  assert.deepEqual(Object.keys(reprocess.body).sort(), ['conversion']);

  const malformed = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'bad-type!',
    click_id: fixture.click.id
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(Object.keys(malformed.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  console.log('conversion contract checks passed');
} finally {
  await context.close();
}
