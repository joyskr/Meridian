import assert from 'node:assert/strict';
import { AppError } from '../../apps/api/dist/platform/http/shared-error.js';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext();

try {
  const signUp = await context.runtime.authService.signUp('owner@example.com', 'Password123!');
  assert.equal(signUp.user.email, 'owner@example.com');
  assert.equal(signUp.user.email_verified, false);
  assert.equal(typeof signUp.rawChallengeToken, 'string');

  await context.runtime.authService.verifyEmail(signUp.rawChallengeToken);

  const login = await context.runtime.authService.login('owner@example.com', 'Password123!');
  assert.equal(login.user.email_verified, true);
  assert.equal(typeof login.rawSessionToken, 'string');

  const currentSession = await context.runtime.authService.getCurrentSession(login.rawSessionToken);
  assert.equal(currentSession.user.email, 'owner@example.com');
  assert.equal(currentSession.session.current, true);

  const resetRequest = await context.runtime.authService.requestPasswordReset('owner@example.com');
  assert.equal(resetRequest.accepted, true);
  assert.equal(typeof resetRequest.rawChallengeToken, 'string');

  await context.runtime.authService.resetPassword(resetRequest.rawChallengeToken, 'NewPassword123!');

  let rejected = false;

  try {
    await context.runtime.authService.login('owner@example.com', 'Password123!');
  } catch (error) {
    rejected = error instanceof AppError && error.code === 'invalid_credentials';
  }

  assert.equal(rejected, true);

  const relogin = await context.runtime.authService.login('owner@example.com', 'NewPassword123!');
  assert.equal(relogin.user.email, 'owner@example.com');

  console.log('auth service unit checks passed');
} finally {
  await context.close();
}
