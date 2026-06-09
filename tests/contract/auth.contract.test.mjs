import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUpResponse = await request(context.app).post('/auth/signup').send({
    email: 'contract@example.com',
    password: 'Password123!'
  });

  assert.equal(signUpResponse.status, 201);
  assert.deepEqual(Object.keys(signUpResponse.body).sort(), ['challenge', 'user']);
  assert.deepEqual(Object.keys(signUpResponse.body.user).sort(), ['created_at', 'email', 'email_verified', 'id']);
  assert.deepEqual(Object.keys(signUpResponse.body.challenge).sort(), ['expires_at', 'purpose']);

  const verificationToken = signUpResponse.headers['x-debug-auth-token'];
  const verifyResponse = await request(context.app).post('/auth/verify-email').send({
    token: verificationToken
  });

  assert.equal(verifyResponse.status, 200);
  assert.deepEqual(Object.keys(verifyResponse.body).sort(), ['user']);

  const loginResponse = await request(context.app).post('/auth/login').send({
    email: 'contract@example.com',
    password: 'Password123!'
  });

  assert.equal(loginResponse.status, 200);
  assert.deepEqual(Object.keys(loginResponse.body).sort(), ['session', 'user']);
  assert.deepEqual(Object.keys(loginResponse.body.session).sort(), ['current', 'expires_at', 'id']);
  assert.equal(Array.isArray(loginResponse.headers['set-cookie']), true);

  const resetRequestResponse = await request(context.app).post('/auth/password-reset/request').send({
    email: 'contract@example.com'
  });

  assert.equal(resetRequestResponse.status, 202);
  assert.deepEqual(resetRequestResponse.body, { accepted: true });

  const invalidLoginResponse = await request(context.app).post('/auth/login').send({
    email: 'contract@example.com',
    password: 'WrongPassword123!'
  });

  assert.equal(invalidLoginResponse.status, 401);
  assert.deepEqual(Object.keys(invalidLoginResponse.body).sort(), ['error']);
  assert.deepEqual(Object.keys(invalidLoginResponse.body.error).sort(), [
    'category',
    'code',
    'details',
    'message',
    'request_id'
  ]);

  console.log('auth contract checks passed');
} finally {
  await context.close();
}
