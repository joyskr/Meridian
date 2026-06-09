import type { NextFunction, Request, Response } from 'express';
import type { RuntimeConfig } from '../config/env.js';

const ALLOWED_HEADERS = 'Content-Type, X-Request-Id';
const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';

export function createCorsMiddleware(config: RuntimeConfig) {
  return function corsMiddleware(request: Request, response: Response, next: NextFunction) {
    const origin = request.header('origin');

    if (origin && config.corsAllowedOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      response.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    }

    if (request.method === 'OPTIONS') {
      response.status(204).send();
      return;
    }

    next();
  };
}
