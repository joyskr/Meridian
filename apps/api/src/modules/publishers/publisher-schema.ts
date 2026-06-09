import { z } from 'zod';

const optionalTrimmedString = z.string().trim().max(160).transform(emptyToNull).nullable().optional();
const optionalNotes = z.string().trim().max(4000).transform(emptyToNull).nullable().optional();
const optionalEmail = z.email().transform((value) => value.trim().toLowerCase()).nullable().optional();
const optionalUrl = z.url().max(500).transform((value) => value.trim()).nullable().optional();
const publisherTier = z.enum(['tier_1', 'tier_2', 'tier_3', 'tier_4']);
const optionalPercent = z.number().int().min(0).max(100).nullable().optional();

export const createPublisherSchema = z.object({
  name: z.string().trim().min(1).max(160),
  website_url: optionalUrl,
  primary_contact_name: optionalTrimmedString,
  primary_contact_email: optionalEmail,
  notes: optionalNotes,
  publisher_tier: publisherTier.optional(),
  publisher_postback_percent: optionalPercent
});

export const updatePublisherSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  website_url: optionalUrl,
  primary_contact_name: optionalTrimmedString,
  primary_contact_email: optionalEmail,
  notes: optionalNotes,
  publisher_tier: publisherTier.optional(),
  publisher_postback_percent: optionalPercent
}).refine(
  (value) =>
    value.name !== undefined ||
    value.website_url !== undefined ||
    value.primary_contact_name !== undefined ||
    value.primary_contact_email !== undefined ||
    value.notes !== undefined ||
    value.publisher_tier !== undefined ||
    value.publisher_postback_percent !== undefined,
  {
    message: 'At least one field must be provided'
  }
);

export const listPublishersQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active')
});

export const updatePublisherTierSettingsSchema = z.object({
  tier_1: z.number().int().min(0).max(100),
  tier_2: z.number().int().min(0).max(100),
  tier_3: z.number().int().min(0).max(100),
  tier_4: z.number().int().min(0).max(100)
});

function emptyToNull(value: string) {
  return value.length === 0 ? null : value;
}
