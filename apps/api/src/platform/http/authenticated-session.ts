import type { Request } from 'express';
import type { RuntimeConfig } from '../config/env.js';
import { AppError } from './shared-error.js';
import { readCookie } from './cookies.js';
import type { AuthService } from '../../modules/auth/auth-service.js';

export async function requireAuthenticatedActor(
  request: Request,
  authService: AuthService,
  config: RuntimeConfig
) {
  const sessionToken = readCookie(request.header('cookie'), config.sessionCookieName);

  if (!sessionToken) {
    throw new AppError('session_not_found', 'authentication', 'Session is missing or expired', 401);
  }

  return authService.getAuthenticatedActor(sessionToken);
}
