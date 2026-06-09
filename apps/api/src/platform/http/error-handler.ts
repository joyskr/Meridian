import type { NextFunction, Request, Response } from 'express';
import { AppError, isAppError } from './shared-error.js';

export function errorHandler(
  error: Error,
  _request: Request,
  response: Response,
  next: NextFunction
) {
  void next;
  const requestId = response.locals.requestId as string | undefined;
  const appError = isAppError(error)
    ? error
    : new AppError('internal_error', 'system', 'Unexpected server error', 500);

  response.status(appError.status).json({
    error: {
      code: appError.code,
      category: appError.category,
      message: appError.message,
      details: appError.details ?? null,
      request_id: requestId ?? null
    }
  });
}
