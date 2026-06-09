type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'business_rule'
  | 'rate_limit'
  | 'idempotency'
  | 'system';

export class AppError extends Error {
  code: string;
  category: ErrorCategory;
  status: number;
  details?: unknown;

  constructor(code: string, category: ErrorCategory, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.category = category;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
