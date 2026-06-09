import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction) {
  const requestId = request.header(REQUEST_ID_HEADER) ?? randomUUID();

  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.locals.requestId = requestId;

  next();
}
