import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import { createTrackedConversionFixture } from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-conversion-e2e@example.com');
  const { agent } = await loginAgent(context, 'owner-conversion-e2e@example.com');
  await createOrganization(agent, 'Conversion E2E Agency');

  const fixture = await createTrackedConversionFixture(context, agent, {
    advertiserName: 'Conversion E2E Advertiser',
    publisherName: 'Conversion E2E Publisher',
    offerName: 'Conversion E2E Offer',
    trackingSlug: 'conversion-e2e-offer',
    redirectUrl: 'https://publisher.example/conversion-e2e',
    clickQuery: '?sub1=e2e-sub1',
    publisherTier: 'tier_4',
    tierSettings: {
      tier_1: 40,
      tier_2: 55,
      tier_3: 70,
      tier_4: 80
    }
  });

  const ingest = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'sale',
    external_event_id: 'evt-e2e-1',
    click_id: fixture.click.id
  });
  assert.equal(ingest.status, 202);
  assert.equal(ingest.body.conversion.status, 'finalized');

  const rejected = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixture.advertiser.id,
    event_type: 'deposit',
    external_event_id: 'evt-e2e-2',
    click_id: fixture.click.id
  });
  assert.equal(rejected.status, 202);
  assert.equal(rejected.body.conversion.status, 'rejected');

  const list = await agent.get('/conversions');
  assert.equal(list.status, 200);
  assert.equal(list.body.conversions.length, 2);

  const detail = await agent.get(`/conversions/${ingest.body.conversion.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.conversion.click.id, fixture.click.id);
  assert.equal(detail.body.conversion.advertiser.id, fixture.advertiser.id);
  assert.equal(detail.body.conversion.offer.id, fixture.offer.id);
  assert.equal(detail.body.conversion.financial_snapshot.publisher_payout, '8.00');

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

  const recoverRejected = await agent.post(`/conversions/${rejected.body.conversion.id}/reprocess`);
  assert.equal(recoverRejected.status, 200);
  assert.equal(recoverRejected.body.conversion.status, 'finalized');

  await agent.patch('/publisher-tier-settings').send({
    tier_1: 40,
    tier_2: 55,
    tier_3: 70,
    tier_4: 90
  });

  const replaceSnapshot = await agent.post(`/conversions/${ingest.body.conversion.id}/reprocess`);
  assert.equal(replaceSnapshot.status, 200);
  assert.equal(replaceSnapshot.body.conversion.financial_snapshot.publisher_payout, '9.00');

  console.log('conversion intake e2e checks passed');
} finally {
  await context.close();
}
