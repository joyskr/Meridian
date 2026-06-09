import { Router, type Response } from 'express';
import { clearSessionCookie, createSessionCookie, readCookie } from '../platform/http/cookies.js';
import { parseBody } from '../platform/http/validation.js';
import { AppError } from '../platform/http/shared-error.js';
import { loginSchema, passwordResetRequestSchema, passwordResetResetSchema, signUpSchema, verifyEmailSchema } from '../modules/auth/auth-schema.js';
import type { RuntimeConfig } from '../platform/config/env.js';
import type { AuthService } from '../modules/auth/auth-service.js';

type AuthRouterDependencies = {
  authService: AuthService;
  config: RuntimeConfig;
};

export function createAuthRouter({ authService, config }: AuthRouterDependencies) {
  const authRouter = Router();

  authRouter.post('/auth/signup', async (request, response, next) => {
    try {
      const body = parseBody(signUpSchema, request.body);
      const result = await authService.signUp(body.email, body.password);

      maybeAttachDebugToken(response, config, result.rawChallengeToken);

      response.status(201).json({
        user: result.user,
        challenge: result.challenge
      });
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/auth/verify-email', async (request, response, next) => {
    try {
      const body = parseBody(verifyEmailSchema, request.body);
      const result = await authService.verifyEmail(body.token);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/auth/login', async (request, response, next) => {
    try {
      const body = parseBody(loginSchema, request.body);
      const result = await authService.login(body.email, body.password);

      response.setHeader('Set-Cookie', createSessionCookie(config, result.rawSessionToken, new Date(result.session.expires_at)));
      response.status(200).json({
        user: result.user,
        session: result.session
      });
    } catch (error) {
      next(error);
    }
  });

  authRouter.get('/auth/session', async (request, response, next) => {
    try {
      const sessionToken = readCookie(request.header('cookie'), config.sessionCookieName);

      if (!sessionToken) {
        throw new AppError('session_not_found', 'authentication', 'Session is missing or expired', 401);
      }

      const result = await authService.getCurrentSession(sessionToken);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/auth/logout', async (request, response, next) => {
    try {
      const sessionToken = readCookie(request.header('cookie'), config.sessionCookieName);
      await authService.logout(sessionToken);

      response.setHeader('Set-Cookie', clearSessionCookie(config));
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/auth/password-reset/request', async (request, response, next) => {
    try {
      const body = parseBody(passwordResetRequestSchema, request.body);
      const result = await authService.requestPasswordReset(body.email);

      maybeAttachDebugToken(response, config, result.rawChallengeToken);

      response.status(202).json({
        accepted: true
      });
    } catch (error) {
      next(error);
    }
  });

  authRouter.post('/auth/password-reset/reset', async (request, response, next) => {
    try {
      const body = parseBody(passwordResetResetSchema, request.body);
      const result = await authService.resetPassword(body.token, body.password);

      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  return authRouter;
}

function maybeAttachDebugToken(
  response: Response,
  config: RuntimeConfig,
  token: string | null
) {
  if (config.nodeEnv === 'test' && token) {
    response.setHeader('x-debug-auth-token', token);
  }
}
