import { z } from 'zod';

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  DATABASE_URL: z.string().min(1).default('postgresql://user:password@localhost:5432/meridian'),
  SESSION_SECRET: z.string().min(16).default('replace-in-runtime'),
  SESSION_COOKIE_NAME: z.string().min(1).default('meridian_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export type RuntimeConfig = {
  apiPort: number;
  webOrigin: string;
  corsAllowedOrigins: string[];
  databaseUrl: string;
  sessionSecret: string;
  sessionCookieName: string;
  sessionTtlHours: number;
  emailVerificationTtlHours: number;
  passwordResetTtlMinutes: number;
  nodeEnv: 'development' | 'test' | 'production';
};

export function readRuntimeConfig(overrides: Partial<Record<keyof z.infer<typeof envSchema>, unknown>> = {}) {
  const parsed = envSchema.parse({
    ...process.env,
    ...overrides
  });
  const corsAllowedOrigins = parseOriginList(parsed.CORS_ALLOWED_ORIGINS ?? parsed.WEB_ORIGIN);

  return {
    apiPort: parsed.API_PORT,
    webOrigin: parsed.WEB_ORIGIN,
    corsAllowedOrigins,
    databaseUrl: parsed.DATABASE_URL,
    sessionSecret: parsed.SESSION_SECRET,
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    sessionTtlHours: parsed.SESSION_TTL_HOURS,
    emailVerificationTtlHours: parsed.EMAIL_VERIFICATION_TTL_HOURS,
    passwordResetTtlMinutes: parsed.PASSWORD_RESET_TTL_MINUTES,
    nodeEnv: parsed.NODE_ENV
  } satisfies RuntimeConfig;
}

function parseOriginList(value: string) {
  return [...new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean))];
}
