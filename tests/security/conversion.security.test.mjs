import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { addOrganizationMember, createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';
import { createTrackedConversionFixture } from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-conversion-security-a@example.com');
  const { agent: ownerAgentA } = await loginAgent(context, 'owner-conversion-security-a@example.com');
  const organizationA = await createOrganization(ownerAgentA, 'Conversion Security Agency A');

  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'viewer-conversion-security@example.com',
    role: 'viewer'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'analyst-conversion-security@example.com',
    role: 'analyst'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'manager-conversion-security@example.com',
    role: 'manager'
  });

  const fixtureA = await createTrackedConversionFixture(context, ownerAgentA, {
    advertiserName: 'Conversion Security Advertiser A',
    publisherName: 'Conversion Security Publisher A',
    offerName: 'Conversion Security Offer A',
    trackingSlug: 'conversion-security-offer-a',
    redirectUrl: 'https://publisher.example/conversion-security-a',
    clickQuery: '?sub1=security-sub1'
  });

  const created = await request(context.app).post('/conversions/ingest').send({
    advertiser_id: fixtureA.advertiser.id,
    event_type: 'sale',
    external_event_id: 'evt-security-1',
    click_id: fixtureA.click.id,
    organization_id: 'forged_org',
    publisher_id: 'forged_pub'
  });
  assert.equal(created.status, 202);
  assert.equal(created.body.conversion.status, 'finalized');
  assert.equal(created.body.conversion.offer_id, fixtureA.offer.id);
  assert.equal(created.body.conversion.publisher_id, fixtureA.publisher.id);

  await createVerifiedUser(context, 'owner-conversion-security-b@example.com');
  const { agent: ownerAgentB } = await loginAgent(context, 'owner-conversion-security-b@example.com');
  const organizationB = await createOrganization(ownerAgentB, 'Conversion Security Agency B');

  const fixtureB = await createTrackedConversionFixture(context, ownerAgentB, {
    advertiserName: 'Conversion Security Advertiser B',
    publisherName: 'Conversion Security Publisher B',
    offerName: 'Conversion Security Offer B',
    trackingSlug: 'conversion-security-offer-b',
    redirectUrl: 'https://publisher.example/conversion-security-b'
  });

  const conflict = await request(context.app).get(
    `/goal?advertiser_id=${fixtureB.advertiser.id}&event_type=sale&external_event_id=evt-security-2&click_id=${fixtureA.click.id}`
  );
  assert.equal(conflict.status, 202);
  assert.equal(conflict.body.conversion.status, 'rejected');
  assert.equal(conflict.body.conversion.rejection_reason, 'attribution_conflict');
  assert.equal(conflict.body.conversion.click_id, null);

  const { agent: viewerAgent } = await loginAgent(context, 'viewer-conversion-security@example.com');
  await viewerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const viewerList = await viewerAgent.get('/conversions');
  assert.equal(viewerList.status, 403);
  assert.equal(viewerList.body.error.code, 'conversion_read_forbidden');

  const viewerDetail = await viewerAgent.get(`/conversions/${created.body.conversion.id}`);
  assert.equal(viewerDetail.status, 403);
  assert.equal(viewerDetail.body.error.code, 'conversion_read_forbidden');

  const viewerReprocess = await viewerAgent.post(`/conversions/${created.body.conversion.id}/reprocess`);
  assert.equal(viewerReprocess.status, 403);
  assert.equal(viewerReprocess.body.error.code, 'conversion_reprocess_forbidden');

  const { agent: managerAgent } = await loginAgent(context, 'manager-conversion-security@example.com');
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });
  const managerReprocess = await managerAgent.post(`/conversions/${created.body.conversion.id}/reprocess`);
  assert.equal(managerReprocess.status, 403);
  assert.equal(managerReprocess.body.error.code, 'conversion_reprocess_forbidden');

  const { agent: analystAgent } = await loginAgent(context, 'analyst-conversion-security@example.com');
  await analystAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });

  const analystList = await analystAgent.get('/conversions');
  assert.equal(analystList.status, 200);

  await ownerAgentB.post('/organizations/select-active').send({
    organization_id: organizationB.organization.id
  });

  const crossTenantDetail = await ownerAgentB.get(`/conversions/${created.body.conversion.id}`);
  assert.equal(crossTenantDetail.status, 404);
  assert.equal(crossTenantDetail.body.error.code, 'conversion_not_found');

  const crossTenantReprocess = await ownerAgentB.post(`/conversions/${created.body.conversion.id}/reprocess`);
  assert.equal(crossTenantReprocess.status, 404);
  assert.equal(crossTenantReprocess.body.error.code, 'conversion_not_found');

  console.log('conversion security checks passed');
} finally {
  await context.close();
}
