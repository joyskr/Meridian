import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthTestContext } from '../helpers/auth-test-context.mjs';

const context = await createAuthTestContext({
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000,https://meridian.rovminds.com,https://track.meridian.rovminds.com'
});

try {
  const frontOrigin = await request(context.app).options('/health').set('Origin', 'https://meridian.rovminds.com');
  assert.equal(frontOrigin.status, 204);
  assert.equal(frontOrigin.headers['access-control-allow-origin'], 'https://meridian.rovminds.com');

  const trackOrigin = await request(context.app).options('/health').set('Origin', 'https://track.meridian.rovminds.com');
  assert.equal(trackOrigin.status, 204);
  assert.equal(trackOrigin.headers['access-control-allow-origin'], 'https://track.meridian.rovminds.com');

  const deniedOrigin = await request(context.app).options('/health').set('Origin', 'https://evil.example');
  assert.equal(deniedOrigin.status, 204);
  assert.equal(deniedOrigin.headers['access-control-allow-origin'], undefined);

  console.log('cors allowlist checks passed');
} finally {
  await context.close();
}
