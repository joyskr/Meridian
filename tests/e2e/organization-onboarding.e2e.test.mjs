import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUpResponse = await request(context.app).post('/auth/signup').send({
    email: 'e2e-owner@example.com',
    password: 'Password123!'
  });

  assert.equal(signUpResponse.status, 201);
  const verificationToken = signUpResponse.headers['x-debug-auth-token'];

  const verifyResponse = await request(context.app).post('/auth/verify-email').send({
    token: verificationToken
  });
  assert.equal(verifyResponse.status, 200);

  const agent = request.agent(context.app);
  const loginResponse = await agent.post('/auth/login').send({
    email: 'e2e-owner@example.com',
    password: 'Password123!'
  });
  assert.equal(loginResponse.status, 200);

  const createOrganizationResponse = await agent.post('/organizations').send({
    name: 'E2E Agency'
  });
  assert.equal(createOrganizationResponse.status, 201);

  const listOrganizationsResponse = await agent.get('/organizations');
  assert.equal(listOrganizationsResponse.status, 200);
  assert.equal(listOrganizationsResponse.body.organizations.length, 1);

  const currentOrganizationResponse = await agent.get('/organizations/current');
  assert.equal(currentOrganizationResponse.status, 200);
  assert.equal(
    currentOrganizationResponse.body.organization.id,
    createOrganizationResponse.body.organization.id
  );
  assert.equal(currentOrganizationResponse.body.membership.role, 'owner');

  const sessionResponse = await agent.get('/auth/session');
  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionResponse.body.user.email, 'e2e-owner@example.com');

  console.log('organization onboarding e2e checks passed');
} finally {
  await context.close();
}
