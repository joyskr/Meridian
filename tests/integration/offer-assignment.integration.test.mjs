import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import {
  addOrganizationMember,
  createOrganization,
  createVerifiedUser,
  loginAgent
} from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-offer-assignment-integration@example.com');
  const { agent: ownerAgent } = await loginAgent(context, 'owner-offer-assignment-integration@example.com');
  const organization = await createOrganization(ownerAgent, 'Offer Assignment Integration Agency');

  await addOrganizationMember(context, {
    organizationId: organization.organization.id,
    email: 'manager-offer-assignment-integration@example.com',
    role: 'manager'
  });

  const { agent: managerAgent } = await loginAgent(
    context,
    'manager-offer-assignment-integration@example.com'
  );
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organization.organization.id
  });

  const advertiser = await managerAgent.post('/advertisers').send({
    name: 'Offer Assignment Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await ownerAgent.post('/publishers').send({
    name: 'Offer Assignment Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null,
    publisher_tier: 'tier_4',
    publisher_postback_percent: 40
  });
  assert.equal(publisher.status, 201);

  const offer = await ownerAgent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Assignment Managed Offer',
    description: null,
    tracking_slug: 'assignment-managed-offer',
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
      },
      {
        event_code: 'lead',
        event_name: 'Lead',
        advertiser_payout: '3.00'
      }
    ]
  });
  assert.equal(offer.status, 201);

  const created = await managerAgent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/integration-assignment',
    conversion_visibility_percent: 75,
    postback_percent: 80,
    payout_overrides: [
      {
        event_code: 'sale',
        publisher_payout_amount: '9.00'
      }
    ]
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.assignment.effective_postback_percent, 40);
  assert.equal(created.body.assignment.payout_overrides.length, 1);
  const assignmentId = created.body.assignment.id;

  const list = await managerAgent.get('/offer-assignments?status=active');
  assert.equal(list.status, 200);
  assert.equal(list.body.assignments.length, 1);

  const detail = await managerAgent.get(`/offer-assignments/${assignmentId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.assignment.publisher.publisher_tier, 'tier_4');

  const trackingLink = await managerAgent.get(`/offer-assignments/${assignmentId}/tracking-link`);
  assert.equal(trackingLink.status, 200);
  assert.match(trackingLink.body.tracking_link.tracking_path, /^\/t\/.+/);

  const duplicate = await managerAgent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/integration-duplicate',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'offer_assignment_duplicate_pair');

  const updated = await managerAgent.patch(`/offer-assignments/${assignmentId}`).send({
    conversion_visibility_percent: 65,
    postback_percent: 30,
    payout_overrides: [
      {
        event_code: 'lead',
        publisher_payout_amount: '2.50'
      }
    ]
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.assignment.effective_postback_percent, 30);
  assert.equal(updated.body.assignment.payout_overrides[0].event_code, 'lead');

  const pause = await managerAgent.post(`/offer-assignments/${assignmentId}/pause`);
  assert.equal(pause.status, 200);
  assert.equal(pause.body.assignment.status, 'paused');

  const resume = await managerAgent.post(`/offer-assignments/${assignmentId}/resume`);
  assert.equal(resume.status, 200);
  assert.equal(resume.body.assignment.status, 'active');

  const archive = await managerAgent.post(`/offer-assignments/${assignmentId}/archive`);
  assert.equal(archive.status, 200);
  assert.equal(archive.body.assignment.status, 'archived');

  const replacement = await managerAgent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/integration-replacement',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(replacement.status, 201);

  const restoreConflict = await managerAgent.post(`/offer-assignments/${assignmentId}/restore`);
  assert.equal(restoreConflict.status, 409);
  assert.equal(restoreConflict.body.error.code, 'offer_assignment_duplicate_pair');

  console.log('offer assignment integration checks passed');
} finally {
  await context.close();
}
