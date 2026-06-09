import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-tracking-security-a@example.com');
  const { agent: ownerAgentA } = await loginAgent(context, 'owner-tracking-security-a@example.com');
  const organizationA = await createOrganization(ownerAgentA, 'Tracking Security Agency A');

  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'viewer-tracking-security@example.com',
    role: 'viewer'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'analyst-tracking-security@example.com',
    role: 'analyst'
  });

  const advertiser = await ownerAgentA.post('/advertisers').send({
    name: 'Tracking Security Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await ownerAgentA.post('/publishers').send({
    name: 'Tracking Security Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(publisher.status, 201);

  const offer = await ownerAgentA.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Tracking Security Offer',
    description: null,
    tracking_slug: 'tracking-security-offer',
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
  await ownerAgentA.post(`/offers/${offer.body.offer.id}/activate`);

  const assignment = await ownerAgentA.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/tracking-security',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(assignment.status, 201);

  const trackingToken = assignment.body.assignment.tracking_link.tracking_path.split('/').pop();
  assert.ok(trackingToken);

  const malformed = await request(context.app).get('/t/bad!token');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, 'tracking_token_invalid');
  assert.equal(malformed.headers.location, undefined);

  const unknown = await request(context.app).get(`/t/${'A'.repeat(43)}`);
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'tracking_unavailable');
  assert.equal(unknown.headers.location, undefined);

  const paused = await ownerAgentA.post(`/offer-assignments/${assignment.body.assignment.id}/pause`);
  assert.equal(paused.status, 200);
  const pausedResponse = await request(context.app).get(`/t/${trackingToken}`);
  assert.equal(pausedResponse.status, 404);
  assert.equal(pausedResponse.body.error.code, 'tracking_unavailable');

  await ownerAgentA.post(`/offer-assignments/${assignment.body.assignment.id}/resume`);
  await ownerAgentA.post(`/offer-assignments/${assignment.body.assignment.id}/archive`);
  const archivedResponse = await request(context.app).get(`/t/${trackingToken}`);
  assert.equal(archivedResponse.status, 404);
  assert.equal(archivedResponse.body.error.code, 'tracking_unavailable');

  const replacement = await ownerAgentA.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/tracking-security-replacement',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(replacement.status, 201);

  const clickResponse = await request(context.app).get(`/t/${replacement.body.assignment.tracking_link.tracking_path.split('/').pop()}?publisher_id=forged`);
  assert.equal(clickResponse.status, 302);

  const clickList = await ownerAgentA.get('/tracking/clicks');
  assert.equal(clickList.status, 200);
  const clickId = clickList.body.clicks[0].id;
  const clickDetail = await ownerAgentA.get(`/tracking/clicks/${clickId}`);
  assert.equal(clickDetail.status, 200);
  assert.equal(clickDetail.body.click.request_metadata.attribution.sub1, null);
  assert.equal(clickDetail.body.click.request_metadata.attribution.utm_source, null);

  const { agent: viewerAgent } = await loginAgent(context, 'viewer-tracking-security@example.com');
  await viewerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const viewerList = await viewerAgent.get('/tracking/clicks');
  assert.equal(viewerList.status, 403);
  assert.equal(viewerList.body.error.code, 'tracking_read_forbidden');

  const viewerDetail = await viewerAgent.get(`/tracking/clicks/${clickId}`);
  assert.equal(viewerDetail.status, 403);
  assert.equal(viewerDetail.body.error.code, 'tracking_read_forbidden');

  await createVerifiedUser(context, 'owner-tracking-security-b@example.com');
  const { agent: ownerAgentB } = await loginAgent(context, 'owner-tracking-security-b@example.com');
  const organizationB = await createOrganization(ownerAgentB, 'Tracking Security Agency B');
  await ownerAgentB.post('/organizations/select-active').send({
    organization_id: organizationB.organization.id
  });

  const crossTenantDetail = await ownerAgentB.get(`/tracking/clicks/${clickId}`);
  assert.equal(crossTenantDetail.status, 404);
  assert.equal(crossTenantDetail.body.error.code, 'click_not_found');

  console.log('tracking security checks passed');
} finally {
  await context.close();
}
