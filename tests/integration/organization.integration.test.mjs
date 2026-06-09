import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUpResponse = await request(context.app).post('/auth/signup').send({
    email: 'org-owner@example.com',
    password: 'Password123!'
  });

  const verificationToken = signUpResponse.headers['x-debug-auth-token'];
  await request(context.app).post('/auth/verify-email').send({
    token: verificationToken
  });

  const agent = request.agent(context.app);
  await agent.post('/auth/login').send({
    email: 'org-owner@example.com',
    password: 'Password123!'
  });

  const emptyCurrentResponse = await agent.get('/organizations/current');
  assert.equal(emptyCurrentResponse.status, 200);
  assert.equal(emptyCurrentResponse.body.organization, null);
  assert.equal(emptyCurrentResponse.body.membership, null);

  const createResponse = await agent.post('/organizations').send({
    name: 'Meridian One'
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.organization.name, 'Meridian One');
  assert.equal(createResponse.body.membership.role, 'owner');

  const listResponse = await agent.get('/organizations');
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.organizations.length, 1);
  assert.equal(listResponse.body.organizations[0].current, true);

  const currentResponse = await agent.get('/organizations/current');
  assert.equal(currentResponse.status, 200);
  assert.equal(currentResponse.body.organization.id, createResponse.body.organization.id);

  const secondResponse = await agent.post('/organizations').send({
    name: 'Meridian Two'
  });

  assert.equal(secondResponse.status, 201);

  const selectResponse = await agent.post('/organizations/select-active').send({
    organization_id: createResponse.body.organization.id
  });

  assert.equal(selectResponse.status, 200);
  assert.equal(selectResponse.body.organization.id, createResponse.body.organization.id);

  const forbiddenResponse = await agent.post('/organizations/select-active').send({
    organization_id: 'org_missing'
  });

  assert.equal(forbiddenResponse.status, 403);
  assert.equal(forbiddenResponse.body.error.code, 'organization_not_accessible');

  console.log('organization integration checks passed');
} finally {
  await context.close();
}
