import { z } from 'zod';

const optionalTrimmedString = z.string().trim().max(160).transform(emptyToNull).nullable().optional();
const optionalNotes = z.string().trim().max(4000).transform(emptyToNull).nullable().optional();
const optionalEmail = z.email().transform((value) => value.trim().toLowerCase()).nullable().optional();
const optionalUrl = z.url().max(500).transform((value) => value.trim()).nullable().optional();

export const createAdvertiserSchema = z.object({
  name: z.string().trim().min(1).max(160),
  website_url: optionalUrl,
  primary_contact_name: optionalTrimmedString,
  primary_contact_email: optionalEmail,
  notes: optionalNotes
});

export const updateAdvertiserSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  website_url: optionalUrl,
  primary_contact_name: optionalTrimmedString,
  primary_contact_email: optionalEmail,
  notes: optionalNotes
}).refine(
  (value) =>
    value.name !== undefined ||
    value.website_url !== undefined ||
    value.primary_contact_name !== undefined ||
    value.primary_contact_email !== undefined ||
    value.notes !== undefined,
  {
    message: 'At least one field must be provided'
  }
);

export const listAdvertisersQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active')
});

function emptyToNull(value: string) {
  return value.length === 0 ? null : value;
}
