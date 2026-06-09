import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import {
  addOrganizationMember,
  createOrganization,
  createVerifiedUser,
  loginAgent
} from '../helpers/membership-scenarios.mjs';
import {
  createTrackedConversionFixture,
  ingestFinalizedConversion
} from '../helpers/conversion-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-payout-security-a@example.com');
  const { agent: ownerAgentA } = await loginAgent(context, 'owner-payout-security-a@example.com');
  const organizationA = await createOrganization(ownerAgentA, 'Payout Security Agency A');

  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'manager-payout-security@example.com',
    role: 'manager'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'analyst-payout-security@example.com',
    role: 'analyst'
  });
  await addOrganizationMember(context, {
    organizationId: organizationA.organization.id,
    email: 'viewer-payout-security@example.com',
    role: 'viewer'
  });

  const fixtureA = await createTrackedConversionFixture(context, ownerAgentA, {
    advertiserName: 'Payout Security Advertiser A',
    publisherName: 'Payout Security Publisher A',
    offerName: 'Payout Security Offer A',
    trackingSlug: 'payout-security-offer-a',
    redirectUrl: 'https://publisher.example/payout-security-a'
  });

  await ingestFinalizedConversion(context, {
    advertiserId: fixtureA.advertiser.id,
    eventType: 'sale',
    externalEventId: 'evt-payout-security-1',
    clickId: fixtureA.click.id
  });

  const createdBatch = await ownerAgentA.post('/payout-batches');
  assert.equal(createdBatch.status, 201);
  const batchId = createdBatch.body.batch.id;
  const payoutId = createdBatch.body.batch.payouts[0].id;

  const { agent: managerAgent } = await loginAgent(context, 'manager-payout-security@example.com');
  await managerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });
  const managerListBatches = await managerAgent.get('/payout-batches');
  assert.equal(managerListBatches.status, 200);
  const managerListPayouts = await managerAgent.get('/payouts');
  assert.equal(managerListPayouts.status, 200);
  const managerPreview = await managerAgent.post('/payout-batches/preview');
  assert.equal(managerPreview.status, 403);
  assert.equal(managerPreview.body.error.code, 'payout_preview_forbidden');
  const managerCreate = await managerAgent.post('/payout-batches');
  assert.equal(managerCreate.status, 403);
  assert.equal(managerCreate.body.error.code, 'payout_create_forbidden');
  const managerApprove = await managerAgent.post(`/payout-batches/${batchId}/approve`);
  assert.equal(managerApprove.status, 403);
  assert.equal(managerApprove.body.error.code, 'payout_approve_forbidden');
  const managerExport = await managerAgent.post(`/payout-batches/${batchId}/export`);
  assert.equal(managerExport.status, 403);
  assert.equal(managerExport.body.error.code, 'payout_export_forbidden');
  const managerReconcile = await managerAgent.post(`/payout-batches/${batchId}/reconcile`);
  assert.equal(managerReconcile.status, 403);
  assert.equal(managerReconcile.body.error.code, 'payout_reconcile_forbidden');
  const managerDelete = await managerAgent.delete(`/payout-batches/${batchId}`);
  assert.equal(managerDelete.status, 403);
  assert.equal(managerDelete.body.error.code, 'payout_delete_forbidden');

  const { agent: analystAgent } = await loginAgent(context, 'analyst-payout-security@example.com');
  await analystAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });
  const analystDetail = await analystAgent.get(`/payouts/${payoutId}`);
  assert.equal(analystDetail.status, 200);

  const { agent: viewerAgent } = await loginAgent(context, 'viewer-payout-security@example.com');
  await viewerAgent.post('/organizations/select-active').send({
    organization_id: organizationA.organization.id
  });
  const viewerList = await viewerAgent.get('/payout-batches');
  assert.equal(viewerList.status, 403);
  assert.equal(viewerList.body.error.code, 'payout_read_forbidden');
  const viewerPayout = await viewerAgent.get(`/payouts/${payoutId}`);
  assert.equal(viewerPayout.status, 403);
  assert.equal(viewerPayout.body.error.code, 'payout_read_forbidden');

  await createVerifiedUser(context, 'owner-payout-security-b@example.com');
  const { agent: ownerAgentB } = await loginAgent(context, 'owner-payout-security-b@example.com');
  const organizationB = await createOrganization(ownerAgentB, 'Payout Security Agency B');
  await ownerAgentB.post('/organizations/select-active').send({
    organization_id: organizationB.organization.id
  });

  const crossTenantBatch = await ownerAgentB.get(`/payout-batches/${batchId}`);
  assert.equal(crossTenantBatch.status, 404);
  assert.equal(crossTenantBatch.body.error.code, 'payout_batch_not_found');
  const crossTenantPayout = await ownerAgentB.get(`/payouts/${payoutId}`);
  assert.equal(crossTenantPayout.status, 404);
  assert.equal(crossTenantPayout.body.error.code, 'payout_not_found');

  console.log('payout security checks passed');
} finally {
  await context.close();
}
