import { ZodError, type ZodType } from 'zod';
import { AppError } from './shared-error.js';

export function parseBody<Output>(schema: ZodType<Output>, body: unknown) {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError('validation_failed', 'validation', 'Request validation failed', 400, {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code
        }))
      });
    }

    throw error;
  }
}
