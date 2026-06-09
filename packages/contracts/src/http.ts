export const AUTH_CLASSES = [
  'Public',
  'Authenticated',
  'Organization Member',
  'Organization Admin',
  'Platform Admin'
] as const;

export type AuthClass = (typeof AUTH_CLASSES)[number];

export type ErrorCategory =
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'business_rule'
  | 'rate_limit'
  | 'idempotency'
  | 'system';

export type ApiErrorEnvelope = {
  error: {
    code: string;
    category: ErrorCategory;
    message: string;
    details: unknown;
    request_id: string | null;
  };
};

export type CursorPage<T> = {
  items: T[];
  next_cursor: string | null;
};
