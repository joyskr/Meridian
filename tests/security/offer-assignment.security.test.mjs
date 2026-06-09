import request from 'supertest';
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
  await createVerifiedUser(context, 'owner-offer-assignment-security-a@example.com');
  const { agent: ownerAgentA } = await loginAgent(context, 'owner-offer-assignment-security-a@example.com');
  const organizationA = await createOrganization(ownerAgentA, 'Offer Assignment Security Agency A');

  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'viewer-offer-assignment-security@example.com',
    role: 'viewer'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'analyst-offer-assignment-security@example.com',
    role: 'analyst'
  });

  const advertiser = await ownerAgentA.post('/advertisers').send({
    name: 'Offer Assignment Security Advertiser',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(advertiser.status, 201);

  const publisher = await ownerAgentA.post('/publishers').send({
    name: 'Offer Assignment Security Publisher',
    website_url: null,
    primary_contact_name: null,
    primary_contact_email: null,
    notes: null
  });
  assert.equal(publisher.status, 201);

  const offer = await ownerAgentA.post('/offers').send({
    advertiser_id: advertiser.body.advertiser.id,
    name: 'Assignment Security Offer',
    description: null,
    tracking_slug: 'assignment-security-offer',
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
        advertiser_payout: '12.00'
      }
    ]
  });
  assert.equal(offer.status, 201);

  const assignment = await ownerAgentA.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/security-assignment',
    conversion_visibility_percent: 90,
    postback_percent: 80,
    payout_overrides: []
  });
  assert.equal(assignment.status, 201);
  const assignmentId = assignment.body.assignment.id;

  const { agent: viewerAgent } = await loginAgent(
    context,
    'viewer-offer-assignment-security@example.com'
  );
  await viewerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const viewerList = await viewerAgent.get('/offer-assignments');
  assert.equal(viewerList.status, 200);
  assert.equal(viewerList.body.assignments.length, 1);
  assert.equal(viewerList.body.assignments[0].id, assignmentId);

  const viewerDetail = await viewerAgent.get(`/offer-assignments/${assignmentId}`);
  assert.equal(viewerDetail.status, 200);

  const viewerWrite = await viewerAgent.post('/offer-assignments').send({
    offer_id: offer.body.offer.id,
    publisher_id: publisher.body.publisher.id,
    redirect_url: 'https://publisher.example/security-viewer-write',
    conversion_visibility_percent: 100,
    postback_percent: 100,
    payout_overrides: []
  });
  assert.equal(viewerWrite.status, 403);
  assert.equal(viewerWrite.body.error.code, 'offer_assignment_write_forbidden');

  const { agent: analystAgent } = await loginAgent(
    context,
    'analyst-offer-assignment-security@example.com'
  );
  await analystAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const analystList = await analystAgent.get('/offer-assignments');
  assert.equal(analystList.status, 200);
  const analystUpdate = await analystAgent.patch(`/offer-assignments/${assignmentId}`).send({
    postback_percent: 30
  });
  assert.equal(analystUpdate.status, 403);
  assert.equal(analystUpdate.body.error.code, 'offer_assignment_write_forbidden');

  await createVerifiedUser(context, 'owner-offer-assignment-security-b@example.com');
  const { agent: ownerAgentB } = await loginAgent(context, 'owner-offer-assignment-security-b@example.com');
  const organizationB = await createOrganization(ownerAgentB, 'Offer Assignment Security Agency B');
  await ownerAgentB.post('/organizations/select-active').send({
    organization_id: organizationB.organization.id
  });

  const crossTenantRead = await ownerAgentB.get(`/offer-assignments/${assignmentId}`);
  assert.equal(crossTenantRead.status, 404);
  assert.equal(crossTenantRead.body.error.code, 'offer_assignment_not_found');

  const unauthenticatedList = await request(context.app).get('/offer-assignments');
  assert.equal(unauthenticatedList.status, 401);
  assert.equal(unauthenticatedList.body.error.code, 'session_not_found');

  console.log('offer assignment security checks passed');
} finally {
  await context.close();
}
