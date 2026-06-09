import request from 'supertest';

export async function createTrackedConversionFixture(context, agent, options = {}) {
  const advertiser = await agent.post('/advertisers').send({
    name: options.advertiserName ?? 'Conversion Fixture Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });

  const publisher = await agent.post('/publishers').send({
    name: options.publisherName ?? 'Conversion Fixture Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null,
    publisher_tier: options.publisherTier ?? undefined,
    publisher_postback_percent: options.publisherPostbackPercent ?? undefined
  });

  if (options.tierSettings) {
    await agent.patch('/publisher-tier-settings').send(options.tierSettings);
  }

  const offer = await agent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: options.offerName ?? 'Conversion Fixture Offer',
    description: null,
    tracking_slug: options.trackingSlug ?? 'conversion-fixture-offer',
    terms: null,
    start_at: null,
    end_at: null,
    daily_cap: null,
    monthly_cap: null,
    overall_cap: null,
    event_definitions: options.eventDefinitions ?? [
      {
        event_code: 'sale',
        event_name: 'Sale',
        advertiser_payout: '10.00'
      }
    ]
  });

  await agent.post(`/offers/${offer.body.offer.id}/activate`);

  const assignment = await agent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: options.redirectUrl ?? 'https://publisher.example/conversion-fixture',
    conversion_visibility_percent: options.conversionVisibilityPercent ?? 100,
    postback_percent: options.assignmentPostbackPercent ?? 100,
    payout_overrides: options.payoutOverrides ?? []
  });

  const trackingToken = assignment.body.assignment.tracking_link.tracking_path.split('/').pop();
  const clickQuery = options.clickQuery ?? '?sub1=fixture-sub1&sub2=fixture-sub2';
  const clickResponse = await request(context.app).get(`/t/${trackingToken}${clickQuery}`);

  if (clickResponse.status !== 302) {
    throw new Error(`Expected click ingest redirect, got ${clickResponse.status}`);
  }

  const clickList = await agent.get('/tracking/clicks');
  const click = clickList.body.clicks[0];

  return {
    advertiser: advertiser.body.advertiser,
    publisher: publisher.body.publisher,
    offer: offer.body.offer,
    assignment: assignment.body.assignment,
    click
  };
}

export async function ingestFinalizedConversion(context, input) {
  const result = await context.runtime.conversionService.ingestConversion(
    input.sourceSurface ?? 'ingest',
    {
      advertiserId: input.advertiserId,
      eventType: input.eventType,
      externalEventId: input.externalEventId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      occurredAt: input.occurredAt ?? null,
      lookupInputs: {
        click_id: input.clickId ?? null,
        sub1: input.sub1 ?? null,
        sub2: input.sub2 ?? null,
        sub3: input.sub3 ?? null,
        sub4: input.sub4 ?? null,
        sub5: input.sub5 ?? null
      }
    }
  );

  if (result.outcome !== 'created' || result.conversion.status !== 'finalized') {
    throw new Error('Expected finalized conversion fixture');
  }

  return result.conversion;
}
