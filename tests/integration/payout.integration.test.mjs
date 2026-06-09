import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import {
  createTrackedConversionFixture,
  ingestFinalizedConversion
} from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-payout-integration@example.com');
  const { agent } = await loginAgent(context, 'owner-payout-integration@example.com');
  await createOrganization(agent, 'Payout Integration Agency');

  const fixture = await createTrackedConversionFixture(context, agent, {
    advertiserName: 'Payout Integration Advertiser',
    publisherName: 'Payout Integration Publisher',
    offerName: 'Payout Integration Offer',
    trackingSlug: 'payout-integration-offer',
    redirectUrl: 'https://publisher.example/payout-integration',
    publisherTier: 'tier_4',
    tierSettings: {
      tier_1: 40,
      tier_2: 55,
      tier_3: 70,
      tier_4: 80
    },
    payoutOverrides: []
  });

  const conversionA = await ingestFinalizedConversion(context, {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-integration-1',
    clickId: fixture.click.id
  });
  await ingestFinalizedConversion(context, {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-integration-2',
    clickId: fixture.click.id
  });

  const preview = await agent.post('/payout-batches/preview');
  assert.equal(preview.status, 200);
  assert.equal(preview.body.preview.payout_count, 2);

  const created = await agent.post('/payout-batches');
  assert.equal(created.status, 201);
  assert.equal(created.body.batch.status, 'draft');
  assert.equal(created.body.batch.payouts.length, 2);
  const batchId = created.body.batch.id;
  const payoutId = created.body.batch.payouts[0].id;

  const duplicateCreate = await agent.post('/payout-batches');
  assert.equal(duplicateCreate.status, 422);
  assert.equal(duplicateCreate.body.error.code, 'payout_batch_empty');
  const batchCountAfterFailedCreate = await context.pool.query(
    'SELECT COUNT(*)::int AS count FROM payout_batches'
  );
  assert.equal(batchCountAfterFailedCreate.rows[0].count, 1);

  const blockedReprocess = await agent.post(`/conversions/${conversionA.id}/reprocess`);
  assert.equal(blockedReprocess.status, 422);
  assert.equal(blockedReprocess.body.error.code, 'conversion_reprocess_blocked_by_payout');

  const batchList = await agent.get('/payout-batches?status=draft');
  assert.equal(batchList.status, 200);
  assert.equal(batchList.body.batches.length, 1);

  const batchDetail = await agent.get(`/payout-batches/${batchId}`);
  assert.equal(batchDetail.status, 200);
  assert.equal(batchDetail.body.batch.payout_count, 2);

  const payoutList = await agent.get(`/payouts?batch_id=${batchId}`);
  assert.equal(payoutList.status, 200);
  assert.equal(payoutList.body.payouts.length, 2);

  const payoutDetail = await agent.get(`/payouts/${payoutId}`);
  assert.equal(payoutDetail.status, 200);
  assert.equal(payoutDetail.body.payout.batch_id, batchId);

  const approve = await agent.post(`/payout-batches/${batchId}/approve`);
  assert.equal(approve.status, 200);
  assert.equal(approve.body.batch.status, 'approved');

  const exportResponse = await agent.post(`/payout-batches/${batchId}/export`);
  assert.equal(exportResponse.status, 200);
  assert.equal(exportResponse.body.batch.status, 'exported');

  const reconcile = await agent.post(`/payout-batches/${batchId}/reconcile`);
  assert.equal(reconcile.status, 200);
  assert.equal(reconcile.body.batch.status, 'reconciled');

  const deleteApproved = await agent.delete(`/payout-batches/${batchId}`);
  assert.equal(deleteApproved.status, 422);
  assert.equal(deleteApproved.body.error.code, 'payout_batch_delete_invalid_state');

  const conversionC = await ingestFinalizedConversion(context, {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-integration-3',
    clickId: fixture.click.id
  });
  const draftBatch = await agent.post('/payout-batches');
  assert.equal(draftBatch.status, 201);

  const deleteDraft = await agent.delete(`/payout-batches/${draftBatch.body.batch.id}`);
  assert.equal(deleteDraft.status, 204);

  const afterDelete = await agent.post(`/conversions/${conversionC.id}/reprocess`);
  assert.equal(afterDelete.status, 200);

  const auditActions = await context.pool.query(
    `SELECT action
     FROM audit_logs
     WHERE entity_type = 'payout_batch'
     ORDER BY created_at ASC, id ASC`
  );
  assert.deepEqual(auditActions.rows.map((row) => row.action), [
    'payout_batch_create',
    'payout_batch_approve',
    'payout_batch_export',
    'payout_batch_reconcile',
    'payout_batch_create',
    'payout_batch_delete'
  ]);

  console.log('payout integration checks passed');
} finally {
  await context.close();
}
