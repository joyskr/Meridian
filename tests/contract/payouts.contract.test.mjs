import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import {
  createTrackedConversionFixture,
  ingestFinalizedConversion
} from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-payout-contract@example.com');
  const { agent } = await loginAgent(context, 'owner-payout-contract@example.com');
  await createOrganization(agent, 'Payout Contract Agency');

  const fixture = await createTrackedConversionFixture(context, agent, {
    advertiserName: 'Payout Contract Advertiser',
    publisherName: 'Payout Contract Publisher',
    offerName: 'Payout Contract Offer',
    trackingSlug: 'payout-contract-offer',
    redirectUrl: 'https://publisher.example/payout-contract'
  });

  await ingestFinalizedConversion(context, {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-contract-1',
    clickId: fixture.click.id
  });

  const preview = await agent.post('/payout-batches/preview');
  assert.equal(preview.status, 200);
  assert.deepEqual(Object.keys(preview.body).sort(), ['preview']);
  assert.deepEqual(Object.keys(preview.body.preview).sort(), [
    'advertiser_payout_total',
    'payout_count',
    'payouts',
    'publisher_payout_total'
  ]);
  assert.deepEqual(Object.keys(preview.body.preview.payouts[0]).sort(), [
    'advertiser',
    'assignment',
    'click_id',
    'conversion_id',
    'event_type',
    'finalized_at',
    'financial_snapshot',
    'offer',
    'publisher',
    'source_surface'
  ]);

  const created = await agent.post('/payout-batches');
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.body).sort(), ['batch']);
  assert.deepEqual(Object.keys(created.body.batch).sort(), [
    'advertiser_payout_total',
    'approved_at',
    'created_at',
    'exported_at',
    'id',
    'payout_count',
    'payouts',
    'publisher_payout_total',
    'reconciled_at',
    'status'
  ]);
  assert.deepEqual(Object.keys(created.body.batch.payouts[0]).sort(), [
    'advertiser',
    'advertiser_payout',
    'assignment',
    'assignment_override_amount',
    'batch_id',
    'batch_status',
    'click_id',
    'conversion_id',
    'created_at',
    'event_type',
    'finalized_at',
    'id',
    'offer',
    'publisher',
    'publisher_payout',
    'publisher_payout_source',
    'publisher_tier',
    'publisher_tier_percent',
    'source_surface'
  ]);

  const listBatches = await agent.get('/payout-batches?status=all');
  assert.equal(listBatches.status, 200);
  assert.deepEqual(Object.keys(listBatches.body).sort(), ['batches']);

  const listPayouts = await agent.get('/payouts');
  assert.equal(listPayouts.status, 200);
  assert.deepEqual(Object.keys(listPayouts.body).sort(), ['payouts']);
  assert.deepEqual(Object.keys(listPayouts.body.payouts[0]).sort(), [
    'advertiser',
    'advertiser_payout',
    'assignment',
    'batch_id',
    'batch_status',
    'click_id',
    'conversion_id',
    'created_at',
    'event_type',
    'finalized_at',
    'id',
    'offer',
    'publisher',
    'publisher_payout',
    'source_surface'
  ]);

  const payoutDetail = await agent.get(`/payouts/${created.body.batch.payouts[0].id}`);
  assert.equal(payoutDetail.status, 200);
  assert.deepEqual(Object.keys(payoutDetail.body).sort(), ['payout']);

  console.log('payout contract checks passed');
} finally {
  await context.close();
}
