import assert from 'node:assert/strict';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';
import { createOrganization, createVerifiedUser, loginAgent } from '../helpers/membership-scenarios.mjs';

const context = await createAuthTestContext();

try {
  await createVerifiedUser(context, 'owner-publisher-e2e@example.com');
  const { agent } = await loginAgent(context, 'owner-publisher-e2e@example.com');
  await createOrganization(agent, 'Publisher E2E Agency');

  const createResponse = await agent.post('/publishers').send({
    name: 'E2E Publisher',
    website_url: 'https://e2e-publisher.example',
    primary_contact_name: 'E2E Lead',
    primary_contact_email: 'lead@e2e-publisher.example',
    notes: 'Created in e2e',
    publisher_tier: 'tier_2',
    publisher_postback_percent: 65
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.publisher.publisher_tier, 'tier_2');
  assert.equal(createResponse.body.publisher.publisher_postback_percent, 65);

  const updateResponse = await agent.patch(`/publishers/${createResponse.body.publisher.id}`).send({
    name: 'E2E Publisher Updated'
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.publisher.name, 'E2E Publisher Updated');

  const archiveResponse = await agent.post(`/publishers/${createResponse.body.publisher.id}/archive`);
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.body.publisher.status, 'archived');

  const restoreResponse = await agent.post(`/publishers/${createResponse.body.publisher.id}/restore`);
  assert.equal(restoreResponse.status, 200);
  assert.equal(restoreResponse.body.publisher.status, 'active');

  const tierSettingsResponse = await agent.patch('/publisher-tier-settings').send({
    tier_1: 40,
    tier_2: 60,
    tier_3: 75,
    tier_4: 85
  });
  assert.equal(tierSettingsResponse.status, 200);
  assert.equal(tierSettingsResponse.body.tier_settings.tier_4, 85);

  console.log('publisher management e2e checks passed');
} finally {
  await context.close();
}
