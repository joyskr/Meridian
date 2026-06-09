import request from 'supertest';
import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-offer-security-a@example.com');
  const { agent: ownerAgentA } = await loginAgent(context, 'owner-offer-security-a@example.com');
  const organizationA = await createOrganization(ownerAgentA, 'Offer Security Agency A');

  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'viewer-offer-security@example.com',
    role: 'viewer'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'analyst-offer-security@example.com',
    role: 'analyst'
  });

  const advertiser = await ownerAgentA.post('/advertisers').send({
    name: 'Offer Security Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const offer = await ownerAgentA.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Security Offer',
    description: null,
    tracking_slug: 'security-offer',
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
  assert.equal(offer.status, 201);
  const offerId = offer.body.offer.id;

  const secondOffer = await ownerAgentA.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Second Security Offer',
    description: null,
    tracking_slug: 'second-security-offer',
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
        advertiser_payout: '11.00'
      }
    ]
  });
  assert.equal(secondOffer.status, 201);

  const { agent: viewerAgent } = await loginAgent(context, 'viewer-offer-security@example.com');
  await viewerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const viewerList = await viewerAgent.get('/offers');
  assert.equal(viewerList.status, 200);
  assert.equal(viewerList.body.offers.length, 2);

  const viewerDetail = await viewerAgent.get(`/offers/${offerId}`);
  assert.equal(viewerDetail.status, 200);

  const viewerCreate = await viewerAgent.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Viewer Forbidden Offer',
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
  assert.equal(viewerCreate.status, 403);
  assert.equal(viewerCreate.body.error.code, 'offer_write_forbidden');

  const { agent: analystAgent } = await loginAgent(context, 'analyst-offer-security@example.com');
  await analystAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const analystList = await analystAgent.get('/offers');
  assert.equal(analystList.status, 200);

  const analystAssignmentAttempt = await analystAgent.patch(`/offers/${secondOffer.body.offer.id}`).send({
    description: 'Analyst update denied'
  });
  assert.equal(analystAssignmentAttempt.status, 403);
  assert.equal(analystAssignmentAttempt.body.error.code, 'offer_write_forbidden');

  const analystUpdate = await analystAgent.patch(`/offers/${offerId}`).send({
    description: 'No access'
  });
  assert.equal(analystUpdate.status, 403);
  assert.equal(analystUpdate.body.error.code, 'offer_write_forbidden');

  await createVerifiedUser(context, 'owner-offer-security-b@example.com');
  const { agent: ownerAgentB } = await loginAgent(context, 'owner-offer-security-b@example.com');
  const organizationB = await createOrganization(ownerAgentB, 'Offer Security Agency B');
  await ownerAgentB.post('/organizations/select-active').send({
    organization_id: organizationB.organization.id
  });

  const crossTenantRead = await ownerAgentB.get(`/offers/${offerId}`);
  assert.equal(crossTenantRead.status, 404);
  assert.equal(crossTenantRead.body.error.code, 'offer_not_found');

  const crossTenantUpdate = await ownerAgentB.patch(`/offers/${offerId}`).send({
    description: 'Cross-tenant mutation'
  });
  assert.equal(crossTenantUpdate.status, 404);
  assert.equal(crossTenantUpdate.body.error.code, 'offer_not_found');

  const unauthenticatedList = await request(context.app).get('/offers');
  assert.equal(unauthenticatedList.status, 401);
  assert.equal(unauthenticatedList.body.error.code, 'session_not_found');

  console.log('offer security checks passed');
} finally {
  await context.close();
}
