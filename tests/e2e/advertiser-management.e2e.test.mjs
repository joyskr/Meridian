import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-advertiser-e2e@example.com');
  const { agent } = await loginAgent(context, 'owner-advertiser-e2e@example.com');
  await createOrganization(agent, 'Advertiser E2E Agency');

  const createResponse = await agent.post('/advertisers').send({
    name: 'E2E Advertiser',
    website_url: 'https://e2e-advertiser.example',
    primary_contact_name: 'E2E Lead',
    primary_contact_email: 'lead@e2e-advertiser.example',
    notes: 'Created in e2e'
  });
  assert.equal(createResponse.status, 201);

  const updateResponse = await agent.patch(`/advertisers/${createResponse.body.advertiser.id}`).send({
    name: 'E2E Advertiser Updated'
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.advertiser.name, 'E2E Advertiser Updated');

  const archiveResponse = await agent.post(`/advertisers/${createResponse.body.advertiser.id}/archive`);
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.body.advertiser.status, 'archived');

  const restoreResponse = await agent.post(`/advertisers/${createResponse.body.advertiser.id}/restore`);
  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.advertiser.status, 'active');

  console.log('advertiser management e2e checks passed');
} finally {
  await context.close();
}
