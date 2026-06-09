import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUpResponse = await request(context.app).post('/auth/signup').send({
    email: 'agency@example.com',
    password: 'Password123!'
  });

  assert.equal(signUpResponse.status, 201);
  assert.equal(signUpResponse.body.user.email, 'agency@example.com');
  assert.equal(signUpResponse.body.user.email_verified, false);
  assert.equal(signUpResponse.body.challenge.purpose, 'email_verification');

  const verificationToken = signUpResponse.headers['x-debug-auth-token'];
  assert.equal(typeof verificationToken, 'string');

  const verifyResponse = await request(context.app).post('/auth/verify-email').send({
    token: verificationToken
  });

  assert.equal(verifyResponse.status, 200);
  assert.equal(verifyResponse.body.user.email_verified, true);

  const agent = request.agent(context.app);
  const loginResponse = await agent.post('/auth/login').send({
    email: 'agency@example.com',
    password: 'Password123!'
  });

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.body.user.email, 'agency@example.com');
  assert.equal(loginResponse.body.session.current, true);

  const sessionResponse = await agent.get('/auth/session');
  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionResponse.body.user.email, 'agency@example.com');

  const logoutResponse = await agent.post('/auth/logout');
  assert.equal(logoutResponse.status, 204);

  const unauthorizedSessionResponse = await agent.get('/auth/session');
  assert.equal(unauthorizedSessionResponse.status, 401);

  const passwordResetRequestResponse = await request(context.app).post('/auth/password-reset/request').send({
    email: 'agency@example.com'
  });

  assert.equal(passwordResetRequestResponse.status, 202);
  assert.equal(passwordResetRequestResponse.body.accepted, true);

  const resetToken = passwordResetRequestResponse.headers['x-debug-auth-token'];
  assert.equal(typeof resetToken, 'string');

  const passwordResetResponse = await request(context.app).post('/auth/password-reset/reset').send({
    token: resetToken,
    password: 'Replacement123!'
  });

  assert.equal(passwordResetResponse.status, 200);
  assert.equal(passwordResetResponse.body.user.email, 'agency@example.com');

  console.log('auth integration checks passed');
} finally {
  await context.close();
}
