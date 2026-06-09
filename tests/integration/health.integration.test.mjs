import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../apps/api/dist/platform/http/create-app.js';

const app = createApp({
  authService: {},
  membershipService: {},
  organizationService: {},
  config: {
    webOrigin: 'http://localhost:3000',
    sessionCookieName: 'meridian_session'
  }
});

const healthResponse = await request(app).get('/health');
assert.equal(healthResponse.status, 200);
assert.equal(healthResponse.body.status, 'ok');
assert.equal(healthResponse.body.service, 'api');
assert.equal(typeof healthResponse.headers['x-request-id'], 'string');

const readyResponse = await request(app).get('/ready');
assert.equal(readyResponse.status, 200);
assert.equal(readyResponse.body.status, 'ready');
assert.equal(readyResponse.body.service, 'api');
assert.equal(typeof readyResponse.headers['x-request-id'], 'string');

console.log('health integration checks passed');
