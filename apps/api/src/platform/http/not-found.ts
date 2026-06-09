import type { NextFunction, Request, Response } from 'express';
import { AppError } from './shared-error.js';

export function notFoundHandler(request: Request, _response: Response, next: NextFunction) {
  next(
    new AppError('not_found', 'not_found', `No route registered for ${request.method} ${request.path}`, 404)
  );
}
