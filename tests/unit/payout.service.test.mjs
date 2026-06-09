import assert from 'node:assert/strict';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import {
  createTrackedConversionFixture,
  ingestFinalizedConversion
} from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-payout-unit@example.com');
  const { agent } = await loginAgent(context, 'owner-payout-unit@example.com');
  const createdOrganization = await createOrganization(agent, 'Payout Unit Agency');
  const organizationId = createdOrganization.organization.id;
  const ownerRow = await context.pool.query(
    `SELECT memberships.id AS membership_id, users.id AS user_id, users.email
     FROM memberships
     INNER JOIN users ON users.id = memberships.user_id
     WHERE memberships.organization_id = $1
       AND users.email = $2
     LIMIT 1`,
    [organizationId, 'owner-payout-unit@example.com']
  );
  const ownerActor = {
    organizationId,
    sessionId: 'sess-owner',
    user: {
      id: ownerRow.rows[0].user_id,
      email: ownerRow.rows[0].email
    },
    membership: {
      id: ownerRow.rows[0].membership_id,
      role: 'owner',
      status: 'active'
    }
  };

  const fixture = await createTrackedConversionFixture(context, agent, {
    advertiserName: 'Payout Unit Advertiser',
    publisherName: 'Payout Unit Publisher',
    offerName: 'Payout Unit Offer',
    trackingSlug: 'payout-unit-offer',
    redirectUrl: 'https://publisher.example/payout-unit',
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
    externalEventId: 'evt-payout-unit-1',
    clickId: fixture.click.id
  });
  const conversionB = await ingestFinalizedConversion(context, {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-unit-2',
    clickId: fixture.click.id
  });

  const preview = await context.runtime.payoutService.previewBatch(ownerActor);
  assert.equal(preview.preview.payout_count, 2);
  assert.equal(preview.preview.advertiser_payout_total, '20.00');
  assert.equal(preview.preview.publisher_payout_total, '16.00');

  const createdBatch = await context.runtime.payoutService.createBatch(ownerActor);
  assert.equal(createdBatch.batch.status, 'draft');
  assert.equal(createdBatch.batch.payout_count, 2);
  assert.match(createdBatch.batch.id, /^pbt_/);
  assert.match(createdBatch.batch.payouts[0].id, /^pay_/);

  const payoutRows = await context.pool.query(
    `SELECT conversion_id
     FROM payouts
     WHERE batch_id = $1
     ORDER BY conversion_id ASC`,
    [createdBatch.batch.id]
  );
  assert.deepEqual(
    payoutRows.rows.map((row) => row.conversion_id).sort(),
    [conversionA.id, conversionB.id].sort()
  );

  await assert.rejects(
    () => context.runtime.conversionService.reprocessConversion(ownerActor, conversionA.id),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'conversion_reprocess_blocked_by_payout');
      return true;
    }
  );

  await context.runtime.payoutService.deleteDraftBatch(ownerActor, createdBatch.batch.id);

  const deletedBatch = await context.pool.query(
    'SELECT COUNT(*)::int AS count FROM payout_batches WHERE id = $1',
    [createdBatch.batch.id]
  );
  assert.equal(deletedBatch.rows[0].count, 0);

  const reprocessed = await context.runtime.conversionService.reprocessConversion(
    ownerActor,
    conversionA.id
  );
  assert.equal(reprocessed.conversion.status, 'finalized');

  const recreatedBatch = await context.runtime.payoutService.createBatch(ownerActor);
  const approvedBatch = await context.runtime.payoutService.approveBatch(ownerActor, recreatedBatch.batch.id);
  assert.equal(approvedBatch.batch.status, 'approved');

  const exportedBatch = await context.runtime.payoutService.exportBatch(ownerActor, recreatedBatch.batch.id);
  assert.equal(exportedBatch.batch.status, 'exported');

  const reconciledBatch = await context.runtime.payoutService.reconcileBatch(
    ownerActor,
    recreatedBatch.batch.id
  );
  assert.equal(reconciledBatch.batch.status, 'reconciled');

  await assert.rejects(
    () => context.runtime.payoutService.deleteDraftBatch(ownerActor, recreatedBatch.batch.id),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'payout_batch_delete_invalid_state');
      return true;
    }
  );

  console.log('payout service unit checks passed');
} finally {
  await context.close();
}
