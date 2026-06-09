import { createHash, randomBytes } from 'node:crypto';

export function createOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string, secret: string) {
  return createHash('sha256').update(`${secret}:${token}`).digest('hex');
}
