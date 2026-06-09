import { z } from 'zod';

const eventCodePattern = /^[a-z][a-z0-9_]{0,39}$/;
const optionalId = z.string().trim().min(1).max(160).optional();
const optionalLookupString = z.string().trim().min(1).max(255).optional();
const optionalOccurredAt = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime')
  .optional();

const basePublicConversionSchema = z
  .object({
    advertiser_id: z.string().trim().min(1).max(160),
    event_type: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(eventCodePattern, 'Event type must start with a letter and use lowercase letters, numbers, or underscores')
      .transform((value) => value.toLowerCase()),
    external_event_id: optionalId,
    idempotency_key: optionalId,
    click_id: optionalId,
    sub1: optionalLookupString,
    sub2: optionalLookupString,
    sub3: optionalLookupString,
    sub4: optionalLookupString,
    sub5: optionalLookupString,
    occurred_at: optionalOccurredAt
  })
  .superRefine((value, context) => {
    if (!value.external_event_id && !value.idempotency_key) {
      context.addIssue({
        code: 'custom',
        message: 'Either external_event_id or idempotency_key is required',
        path: ['external_event_id']
      });
    }

    if (
      !value.click_id &&
      !value.sub1 &&
      !value.sub2 &&
      !value.sub3 &&
      !value.sub4 &&
      !value.sub5
    ) {
      context.addIssue({
        code: 'custom',
        message: 'At least one click lookup input is required',
        path: ['click_id']
      });
    }
  });

export const ingestConversionBodySchema = basePublicConversionSchema;
export const ingestConversionQuerySchema = basePublicConversionSchema;

export const listConversionsQuerySchema = z.object({
  status: z.enum(['received', 'finalized', 'rejected', 'all']).default('all'),
  advertiser_id: z.string().trim().min(1).optional(),
  offer_id: z.string().trim().min(1).optional(),
  publisher_id: z.string().trim().min(1).optional(),
  click_id: z.string().trim().min(1).optional()
});
