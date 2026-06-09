import { z } from 'zod';

const email = z.email().transform((value) => value.trim().toLowerCase());
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be at most 128 characters long');
const token = z.string().min(16, 'Token must be provided');

export const signUpSchema = z.object({
  email,
  password
});

export const verifyEmailSchema = z.object({
  token
});

export const loginSchema = z.object({
  email,
  password
});

export const passwordResetRequestSchema = z.object({
  email
});

export const passwordResetResetSchema = z.object({
  token,
  password
});
