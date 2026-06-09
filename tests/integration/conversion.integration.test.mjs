import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import { createTrackedConversionFixture } from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-conversion-integration@example.com');
  const { agent } = await loginAgent(context, 'owner-conversion-integration@example.com');
  await createOrganization(agent, 'Conversion Integration Agency');

  const fixture = await createTrackedConversionFixture(context, agent, {
    advertiserName: 'Conversion Integration Advertiser',
    publisherName: 'Conversion Integration Publisher',
    offerName: 'Conversion Integration Offer',
    trackingSlug: 'conversion-integration-offer',
    redirectUrl: 'https://publisher.example/conversion-integration',
    clickQuery: '?sub1=integration-sub1&sub2=integration-sub2',
    publisherTier: 'tier_4',
    publisherPostbackPercent: 90,
    tierSettings: {
      tier_1: 40,
      tier_2: 55,
      tier_3: 70,
      tier_4: 80
    },
    conversionVisibilityPercent: 100,
    assignmentPostbackPercent: 80
  });

  const created = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'sale',
    external_event_id: 'evt-integration-1',
    click_id: fixture.click.id,
    occurred_at: '2026-06-07T11:00:00.000Z',
    organization_id: 'forged_org',
    offer_id: 'forged_offer'
  });
  assert.equal(created.status, 202);
  assert.equal(created.body.outcome, 'created');
  assert.equal(created.body.conversion.status, 'finalized');
  assert.equal(created.body.conversion.click_id, fixture.click.id);
  assert.equal(created.body.conversion.offer_id, fixture.offer.id);
  assert.equal(created.body.conversion.publisher_id, fixture.publisher.id);
  assert.ok(created.body.conversion.finalized_at);

  const duplicate = await request(context.app).get(
    `/goal?advertiser_id=${fixture.advertiser.id}&event_type=sale&external_event_id=evt-integration-1&sub1=integration-sub1`
  );
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.outcome, 'duplicate');
  assert.equal(duplicate.body.conversion.id, created.body.conversion.id);

  const gpixel = await request(context.app).get(
    `/gpixel?advertiser_id=${fixture.advertiser.id}&event_type=sale&external_event_id=evt-integration-2&sub1=integration-sub1`
  );
  assert.equal(gpixel.status, 202);
  assert.equal(gpixel.body.conversion.status, 'finalized');

  const goalIdempotent = await request(context.app).get(
    `/goal?advertiser_id=${fixture.advertiser.id}&event_type=sale&idempotency_key=idemp-integration-3&sub1=integration-sub1`
  );
  assert.equal(goalIdempotent.status, 202);
  assert.equal(goalIdempotent.body.conversion.status, 'finalized');
  assert.equal(goalIdempotent.body.conversion.source_surface, 'goal');

  const clickNotFound = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'sale',
    external_event_id: 'evt-integration-3',
    click_id: 'clk_missing'
  });
  assert.equal(clickNotFound.status, 202);
  assert.equal(clickNotFound.body.conversion.status, 'rejected');
  assert.equal(clickNotFound.body.conversion.rejection_reason, 'click_not_found');

  const unknownEvent = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'deposit',
    external_event_id: 'evt-integration-4',
    click_id: fixture.click.id
  });
  assert.equal(unknownEvent.status, 202);
  assert.equal(unknownEvent.body.conversion.status, 'rejected');
  assert.equal(unknownEvent.body.conversion.rejection_reason, 'unknown_event_type');

  const attributionConflict = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'sale',
    external_event_id: 'evt-integration-5',
    click_id: fixture.click.id,
    sub1: 'mismatched-sub1'
  });
  assert.equal(attributionConflict.status, 202);
  assert.equal(attributionConflict.body.conversion.status, 'rejected');
  assert.equal(attributionConflict.body.conversion.rejection_reason, 'attribution_conflict');

  const invalidPayload = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'sale'
  });
  assert.equal(invalidPayload.status, 400);

  const list = await agent.get('/conversions');
  assert.equal(list.status, 200);
  assert.equal(list.body.conversions.length, 6);

  const detail = await agent.get(`/conversions/${created.body.conversion.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.conversion.financial_snapshot.advertiser_payout, '10.00');
  assert.equal(detail.body.conversion.financial_snapshot.publisher_payout, '8.00');
  assert.equal(detail.body.conversion.financial_snapshot.publisher_payout_source, 'publisher_tier');
  assert.equal(detail.body.conversion.financial_snapshot.publisher_tier, 'tier_4');
  assert.equal(detail.body.conversion.financial_snapshot.publisher_tier_percent, 80);
  assert.equal(detail.body.conversion.visibility_snapshot.conversion_visibility_percent, 100);
  assert.equal(detail.body.conversion.visibility_snapshot.conversion_visible_to_publisher, true);
  assert.equal(detail.body.conversion.postback_snapshot.publisher_postback_percent, 90);
  assert.equal(detail.body.conversion.postback_snapshot.assignment_postback_percent, 80);
  assert.equal(detail.body.conversion.postback_snapshot.effective_postback_percent, 80);
  assert.equal(typeof detail.body.conversion.postback_snapshot.postback_eligible, 'boolean');

  const idempotentDetail = await agent.get(`/conversions/${goalIdempotent.body.conversion.id}`);
  assert.equal(idempotentDetail.status, 200);
  assert.equal(idempotentDetail.body.conversion.idempotency_key, 'idemp-integration-3');
  assert.equal(idempotentDetail.body.conversion.external_event_id, null);
  assert.equal(idempotentDetail.body.conversion.source_surface, 'goal');

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

  const rejectedToFinalized = await agent.post(`/conversions/${unknownEvent.body.conversion.id}/reprocess`);
  assert.equal(rejectedToFinalized.status, 200);
  assert.equal(rejectedToFinalized.body.conversion.status, 'finalized');
  assert.equal(rejectedToFinalized.body.conversion.event_type, 'deposit');
  assert.equal(rejectedToFinalized.body.conversion.financial_snapshot.advertiser_payout, '15.00');

  await agent.patch('/publisher-tier-settings').send({
    tier_1: 40,
    tier_2: 55,
    tier_3: 70,
    tier_4: 90
  });

  const finalizedToFinalized = await agent.post(`/conversions/${created.body.conversion.id}/reprocess`);
  assert.equal(finalizedToFinalized.status, 200);
  assert.equal(finalizedToFinalized.body.conversion.status, 'finalized');
  assert.equal(finalizedToFinalized.body.conversion.financial_snapshot.publisher_payout, '9.00');
  assert.equal(finalizedToFinalized.body.conversion.financial_snapshot.publisher_tier_percent, 90);

  await agent.patch(`/offers/${fixture.offer.id}`).send({
    event_definitions: [
      {
        event_code: 'lead',
        event_name: 'Lead',
        advertiser_payout: '2.50'
      }
    ]
  });

  const deniedDowngrade = await agent.post(`/conversions/${created.body.conversion.id}/reprocess`);
  assert.equal(deniedDowngrade.status, 422);
  assert.equal(deniedDowngrade.body.error.code, 'conversion_reprocess_unresolved');

  const afterDenied = await agent.get(`/conversions/${created.body.conversion.id}`);
  assert.equal(afterDenied.status, 200);
  assert.equal(afterDenied.body.conversion.status, 'finalized');
  assert.equal(afterDenied.body.conversion.financial_snapshot.publisher_payout, '9.00');

  const rowCount = await context.pool.query('SELECT COUNT(*)::int AS count FROM conversions');
  assert.equal(rowCount.rows[0].count, 6);

  const auditRows = await context.pool.query(
    `SELECT COUNT(*)::int AS count
     FROM audit_logs
     WHERE action = 'conversion_reprocess'`
  );
  assert.equal(auditRows.rows[0].count, 3);

  console.log('conversion integration checks passed');
} finally {
  await context.close();
}
