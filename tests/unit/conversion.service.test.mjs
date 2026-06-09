import assert from 'node:assert/strict';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import { createTrackedConversionFixture } from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-conversion-unit@example.com');
  const { agent } = await loginAgent(context, 'owner-conversion-unit@example.com');
  const createdOrganization = await createOrganization(agent, 'Conversion Unit Agency');
  const organizationId = createdOrganization.organization.id;
  const ownerRow = await context.pool.query(
    `SELECT memberships.id AS membership_id, users.id AS user_id, users.email
     FROM memberships
     INNER JOIN users ON users.id = memberships.user_id
     WHERE memberships.organization_id = $1
       AND users.email = $2
     LIMIT 1`,
    [organizationId, 'owner-conversion-unit@example.com']
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
    advertiserName: 'Conversion Unit Advertiser',
    publisherName: 'Conversion Unit Publisher',
    offerName: 'Conversion Unit Offer',
    trackingSlug: 'conversion-unit-offer',
    redirectUrl: 'https://publisher.example/conversion-unit',
    publisherTier: 'tier_4',
    publisherPostbackPercent: 90,
    tierSettings: {
      tier_1: 40,
      tier_2: 55,
      tier_3: 70,
      tier_4: 80
    },
    conversionVisibilityPercent: 100,
    assignmentPostbackPercent: 80,
    payoutOverrides: []
  });

  const created = await context.runtime.conversionService.ingestConversion('ingest', {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-unit-1',
    idempotencyKey: null,
    occurredAt: new Date('2026-06-07T10:00:00.000Z'),
    lookupInputs: {
      click_id: fixture.click.id,
      sub1: null,
      sub2: null,
      sub3: null,
      sub4: null,
      sub5: null
    }
  });

  assert.equal(created.outcome, 'created');
  assert.match(created.conversion.id, /^cnv_/);
  assert.equal(created.conversion.status, 'finalized');
  assert.equal(created.conversion.click_id, fixture.click.id);
  assert.ok(created.conversion.finalized_at);

  const stored = await context.pool.query(
    `SELECT status, advertiser_payout::text AS advertiser_payout, publisher_payout::text AS publisher_payout,
        publisher_payout_source, publisher_tier, publisher_tier_percent, assignment_override_amount::text AS assignment_override_amount,
        conversion_visibility_percent, conversion_visible_to_publisher, publisher_postback_percent,
        assignment_postback_percent, effective_postback_percent, postback_eligible
     FROM conversions
     WHERE id = $1`,
    [created.conversion.id]
  );
  assert.equal(stored.rows[0].status, 'finalized');
  assert.equal(stored.rows[0].advertiser_payout, '10');
  assert.equal(stored.rows[0].publisher_payout, '8');
  assert.equal(stored.rows[0].publisher_payout_source, 'publisher_tier');
  assert.equal(stored.rows[0].publisher_tier, 'tier_4');
  assert.equal(stored.rows[0].publisher_tier_percent, 80);
  assert.equal(stored.rows[0].assignment_override_amount, null);
  assert.equal(stored.rows[0].conversion_visibility_percent, 100);
  assert.equal(stored.rows[0].conversion_visible_to_publisher, true);
  assert.equal(stored.rows[0].publisher_postback_percent, 90);
  assert.equal(stored.rows[0].assignment_postback_percent, 80);
  assert.equal(stored.rows[0].effective_postback_percent, 80);
  assert.equal(typeof stored.rows[0].postback_eligible, 'boolean');

  const duplicate = await context.runtime.conversionService.ingestConversion('goal', {
    advertiserId: fixture.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-unit-1',
    idempotencyKey: 'idemp-unit-dup',
    occurredAt: null,
    lookupInputs: {
      click_id: fixture.click.id,
      sub1: null,
      sub2: null,
      sub3: null,
      sub4: null,
      sub5: null
    }
  });

  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal(duplicate.conversion.id, created.conversion.id);

  const unknownEvent = await context.runtime.conversionService.ingestConversion('ingest', {
    advertiserId: fixture.advertiser.id,
    eventType: 'deposit',
    externalEventId: 'evt-unit-2',
    idempotencyKey: null,
    occurredAt: null,
    lookupInputs: {
      click_id: fixture.click.id,
      sub1: null,
      sub2: null,
      sub3: null,
      sub4: null,
      sub5: null
    }
  });

  assert.equal(unknownEvent.outcome, 'created');
  assert.equal(unknownEvent.conversion.status, 'rejected');
  assert.equal(unknownEvent.conversion.rejection_reason, 'unknown_event_type');

  await agent.patch(`/offers/${fixture.offer.id}`).send({
    event_definitions: [
      {
        event_code: 'sale',
        event_name: 'Sale',
        advertiser_payout: '10.00'
      },
      {
        event_code: 'deposit',
        event_name: 'Deposit',
        advertiser_payout: '15.00'
      }
    ]
  });

  const reprocessedRejected = await context.runtime.conversionService.reprocessConversion(
    ownerActor,
    unknownEvent.conversion.id
  );
  assert.equal(reprocessedRejected.conversion.status, 'finalized');
  assert.equal(reprocessedRejected.conversion.event_type, 'deposit');
  assert.equal(reprocessedRejected.conversion.financial_snapshot.advertiser_payout, '15.00');

  await agent.patch('/publisher-tier-settings').send({
    tier_1: 40,
    tier_2: 55,
    tier_3: 70,
    tier_4: 90
  });

  const finalReprocess = await context.runtime.conversionService.reprocessConversion(
    ownerActor,
    created.conversion.id
  );
  assert.equal(finalReprocess.conversion.status, 'finalized');
  assert.equal(finalReprocess.conversion.financial_snapshot.publisher_payout, '9.00');

  const auditCount = await context.pool.query(
    `SELECT COUNT(*)::int AS count
     FROM audit_logs
     WHERE entity_type = 'conversion'
       AND entity_id = $1
       AND action = 'conversion_reprocess'`,
    [created.conversion.id]
  );
  assert.equal(auditCount.rows[0].count, 1);

  await agent.patch(`/offers/${fixture.offer.id}`).send({
    event_definitions: [
      {
        event_code: 'lead',
        event_name: 'Lead',
        advertiser_payout: '3.00'
      }
    ]
  });

  await assert.rejects(
    () => context.runtime.conversionService.reprocessConversion(ownerActor, created.conversion.id),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'conversion_reprocess_unresolved');
      return true;
    }
  );

  const failedAuditCount = await context.pool.query(
    `SELECT COUNT(*)::int AS count
     FROM audit_logs
     WHERE entity_type = 'conversion'
       AND entity_id = $1
       AND action = 'conversion_reprocess'`,
    [created.conversion.id]
  );
  assert.equal(failedAuditCount.rows[0].count, 2);

  await assert.rejects(
    () =>
      context.runtime.conversionService.getConversion(
        {
          organizationId: fixture.advertiser.id,
          sessionId: 'sess',
          user: { id: 'usr', email: 'viewer@example.com' },
          membership: { id: 'mem', role: 'viewer', status: 'active' }
        },
        created.conversion.id
      ),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'conversion_read_forbidden');
      return true;
    }
  );

  console.log('conversion service unit checks passed');
} finally {
  await context.close();
}
