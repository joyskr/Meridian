import { parse, serialize } from 'cookie';
import type { RuntimeConfig } from '../config/env.js';

export function readCookie(headerValue: string | undefined, name: string) {
  if (!headerValue) {
    return null;
  }

  const cookies = parse(headerValue);

  return cookies[name] ?? null;
}

export function createSessionCookie(config: RuntimeConfig, token: string, expiresAt: Date) {
  return serialize(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    expires: expiresAt
  });
}

export function clearSessionCookie(config: RuntimeConfig) {
  return serialize(config.sessionCookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    expires: new Date(0)
  });
}
