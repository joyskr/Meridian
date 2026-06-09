import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import {
  createTrackedConversionFixture,
  ingestFinalizedConversion
} from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-payout-e2e@example.com');
  const { agent } = await loginAgent(context, 'owner-payout-e2e@example.com');
  await createOrganization(agent, 'Payout E2E Agency');

  const fixture = await createTrackedConversionFixture(context, agent, {
    advertiserName: 'Payout E2E Advertiser',
    publisherName: 'Payout E2E Publisher',
    offerName: 'Payout E2E Offer',
    trackingSlug: 'payout-e2e-offer',
    redirectUrl: 'https://publisher.example/payout-e2e'
  });

  await ingestFinalizedConversion(context, {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-e2e-1',
    clickId: fixture.click.id
  });

  const preview = await agent.post('/payout-batches/preview');
  assert.equal(preview.status, 200);
  assert.equal(preview.body.preview.payout_count, 1);

  const created = await agent.post('/payout-batches');
  assert.equal(created.status, 201);
  assert.equal(created.body.batch.status, 'draft');

  const approved = await agent.post(`/payout-batches/${created.body.batch.id}/approve`);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.batch.status, 'approved');

  const exported = await agent.post(`/payout-batches/${created.body.batch.id}/export`);
  assert.equal(exported.status, 200);
  assert.equal(exported.body.batch.status, 'exported');

  const reconciled = await agent.post(`/payout-batches/${created.body.batch.id}/reconcile`);
  assert.equal(reconciled.status, 200);
  assert.equal(reconciled.body.batch.status, 'reconciled');

  await ingestFinalizedConversion(context, {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-e2e-2',
    clickId: fixture.click.id
  });

  const draftBatch = await agent.post('/payout-batches');
  assert.equal(draftBatch.status, 201);
  assert.equal(draftBatch.body.batch.status, 'draft');

  const deleted = await agent.delete(`/payout-batches/${draftBatch.body.batch.id}`);
  assert.equal(deleted.status, 204);

  console.log('payout management e2e checks passed');
} finally {
  await context.close();
}
