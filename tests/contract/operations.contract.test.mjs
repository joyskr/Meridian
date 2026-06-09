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
assert.deepEqual(Object.keys(healthResponse.body).sort(), ['service', 'status']);
assert.equal(healthResponse.body.status, 'ok');
assert.equal(healthResponse.body.service, 'api');

const readyResponse = await request(app).get('/ready');
assert.deepEqual(Object.keys(readyResponse.body).sort(), ['service', 'status']);
assert.equal(readyResponse.body.status, 'ready');
assert.equal(readyResponse.body.service, 'api');

console.log('operations contract checks passed');
