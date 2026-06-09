import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUpResponse = await request(context.app).post('/auth/signup').send({
    email: 'contract-org@example.com',
    password: 'Password123!'
  });
  const verificationToken = signUpResponse.headers['x-debug-auth-token'];

  await request(context.app).post('/auth/verify-email').send({
    token: verificationToken
  });

  const agent = request.agent(context.app);
  await agent.post('/auth/login').send({
    email: 'contract-org@example.com',
    password: 'Password123!'
  });

  const createResponse = await agent.post('/organizations').send({
    name: 'Contract Org'
  });

  assert.equal(createResponse.status, 201);
  assert.deepEqual(Object.keys(createResponse.body).sort(), ['membership', 'organization']);
  assert.deepEqual(Object.keys(createResponse.body.organization).sort(), [
    'created_at',
    'id',
    'name',
    'updated_at'
  ]);
  assert.deepEqual(Object.keys(createResponse.body.membership).sort(), [
    'id',
    'joined_at',
    'role',
    'status'
  ]);

  const listResponse = await agent.get('/organizations');
  assert.equal(listResponse.status, 200);
  assert.deepEqual(Object.keys(listResponse.body).sort(), ['organizations']);
  assert.equal(Array.isArray(listResponse.body.organizations), true);
  assert.deepEqual(Object.keys(listResponse.body.organizations[0]).sort(), [
    'current',
    'membership',
    'organization'
  ]);

  const currentResponse = await agent.get('/organizations/current');
  assert.equal(currentResponse.status, 200);
  assert.deepEqual(Object.keys(currentResponse.body).sort(), ['membership', 'organization']);

  const invalidCreateResponse = await agent.post('/organizations').send({
    name: ''
  });
  assert.equal(invalidCreateResponse.status, 400);
  assert.deepEqual(Object.keys(invalidCreateResponse.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  console.log('organizations contract checks passed');
} finally {
  await context.close();
}
