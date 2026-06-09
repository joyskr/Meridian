import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-offer-integration@example.com');
  const { agent: ownerAgent } = await loginAgent(context, 'owner-offer-integration@example.com');
  const organization = await createOrganization(ownerAgent, 'Offer Integration Agency');

  await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-offer-integration@example.com',
    role: 'manager'
  });

  const { agent: managerAgent } = await loginAgent(context, 'manager-offer-integration@example.com');
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organization.organization.id
  });

  const advertiserA = await managerAgent.post('/advertisers').send({
    name: 'Offer Advertiser A',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiserA.status, 201);

  const advertiserB = await managerAgent.post('/advertisers').send({
    name: 'Offer Advertiser B',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiserB.status, 201);

  const created = await managerAgent.post('/offers').send({
    advertiser_id: advertiserA.body.advertiser.id,
    name: 'Integrated Offer',
    description: 'Integration path',
    tracking_slug: 'integrated-offer',
    terms: 'Standard terms',
    start_at: null,
    end_at: null,
    daily_cap: 10,
    monthly_cap: 100,
    overall_cap: 1000,
    event_definitions: [
      {
        event_code: 'sale',
        event_name: 'Sale',
        advertiser_payout: '10.00'
      },
      {
        event_code: 'custom_bonus',
        event_name: 'Custom Bonus',
        advertiser_payout: '12.50'
      }
    ]
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.offer.status, 'draft');
  assert.equal(created.body.offer.event_definitions.length, 2);

  const listDraft = await managerAgent.get('/offers?status=draft');
  assert.equal(listDraft.status, 200);
  assert.equal(listDraft.body.offers.length, 1);

  const duplicate = await managerAgent.post('/offers').send({
    advertiser_id: advertiserA.body.advertiser.id,
    name: ' integrated   offer ',
    description: null,
    tracking_slug: null,
    terms: null,
    start_at: null,
    end_at: null,
    daily_cap: null,
    monthly_cap: null,
    overall_cap: null,
    event_definitions: []
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'offer_duplicate_name');

  const sameNameDifferentAdvertiser = await managerAgent.post('/offers').send({
    advertiser_id: advertiserB.body.advertiser.id,
    name: 'Integrated Offer',
    description: null,
    tracking_slug: null,
    terms: null,
    start_at: null,
    end_at: null,
    daily_cap: null,
    monthly_cap: null,
    overall_cap: null,
    event_definitions: []
  });
  assert.equal(sameNameDifferentAdvertiser.status, 201);

  const detail = await managerAgent.get(`/offers/${created.body.offer.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.offer.advertiser.id, advertiserA.body.advertiser.id);

  const updated = await managerAgent.patch(`/offers/${created.body.offer.id}`).send({
    advertiser_id: advertiserB.body.advertiser.id,
    name: 'Integrated Offer Updated',
    tracking_slug: 'integrated-offer-v2',
    event_definitions: [
      {
        event_code: 'sale',
        event_name: 'Sale',
        advertiser_payout: '11.00'
      }
    ]
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.offer.name, 'Integrated Offer Updated');
  assert.equal(updated.body.offer.advertiser.id, advertiserB.body.advertiser.id);
  assert.equal(updated.body.offer.event_definitions.length, 1);

  const activate = await managerAgent.post(`/offers/${created.body.offer.id}/activate`);
  assert.equal(activate.status, 200);
  assert.equal(activate.body.offer.status, 'active');

  const pause = await managerAgent.post(`/offers/${created.body.offer.id}/pause`);
  assert.equal(pause.status, 200);
  assert.equal(pause.body.offer.status, 'paused');

  const resume = await managerAgent.post(`/offers/${created.body.offer.id}/resume`);
  assert.equal(resume.status, 200);
  assert.equal(resume.body.offer.status, 'active');

  const archive = await managerAgent.post(`/offers/${created.body.offer.id}/archive`);
  assert.equal(archive.status, 200);
  assert.equal(archive.body.offer.status, 'archived');

  const restore = await managerAgent.post(`/offers/${created.body.offer.id}/restore`);
  assert.equal(restore.status, 200);
  assert.equal(restore.body.offer.status, 'draft');

  const noEventsActivate = await managerAgent.post(`/offers/${sameNameDifferentAdvertiser.body.offer.id}/activate`);
  assert.equal(noEventsActivate.status, 422);
  assert.equal(noEventsActivate.body.error.code, 'offer_event_definitions_required');

  await managerAgent.post(`/advertisers/${advertiserB.body.advertiser.id}/archive`);
  const archivedAdvertiserOffer = await managerAgent.post('/offers').send({
    advertiser_id: advertiserB.body.advertiser.id,
    name: 'Archived Advertiser Offer',
    description: null,
    tracking_slug: null,
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
  assert.equal(archivedAdvertiserOffer.status, 422);
  assert.equal(archivedAdvertiserOffer.body.error.code, 'advertiser_inactive');

  console.log('offer integration checks passed');
} finally {
  await context.close();
}
