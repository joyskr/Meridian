import { z } from 'zod';

const payoutAmount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Publisher payout override must be a non-negative amount with up to 2 decimals')
  .refine((value) => Number(value) > 0, 'Publisher payout override must be greater than 0');

const payoutOverrideSchema = z.object({
  event_code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9_]{0,39}$/, 'Event code must start with a letter and use lowercase letters, numbers, or underscores')
    .transform((value) => value.toLowerCase()),
  publisher_payout_amount: payoutAmount
});

const redirectUrlSchema = z
  .string()
  .trim()
  .url('Redirect URL must be a valid URL')
  .refine(
    (value) => value.startsWith('http://') || value.startsWith('https://'),
    'Redirect URL must use http or https'
  );

function validateDuplicateOverrideEventCodes(
  payoutOverrides: Array<{ event_code: string }>,
  context: z.RefinementCtx
) {
  const seen = new Set<string>();

  for (const [index, override] of payoutOverrides.entries()) {
    if (seen.has(override.event_code)) {
      context.addIssue({
        code: 'custom',
        message: 'Event code must be unique within assignment payout overrides',
        path: ['payout_overrides', index, 'event_code']
      });
      continue;
    }

    seen.add(override.event_code);
  }
}

export const createOfferAssignmentSchema = z
  .object({
    offer_id: z.string().trim().min(1),
    publisher_id: z.string().trim().min(1),
    redirect_url: redirectUrlSchema,
    conversion_visibility_percent: z.number().int().min(0).max(100).nullable().optional(),
    postback_percent: z.number().int().min(0).max(100).nullable().optional(),
    payout_overrides: z.array(payoutOverrideSchema).max(25).optional()
  })
  .superRefine((value, context) => {
    if (value.payout_overrides) {
      validateDuplicateOverrideEventCodes(value.payout_overrides, context);
    }
  });

export const updateOfferAssignmentSchema = z
  .object({
    redirect_url: redirectUrlSchema.optional(),
    conversion_visibility_percent: z.number().int().min(0).max(100).nullable().optional(),
    postback_percent: z.number().int().min(0).max(100).nullable().optional(),
    payout_overrides: z.array(payoutOverrideSchema).max(25).optional()
  })
  .superRefine((value, context) => {
    if (
      value.redirect_url === undefined &&
      value.conversion_visibility_percent === undefined &&
      value.postback_percent === undefined &&
      value.payout_overrides === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'At least one field must be provided',
        path: []
      });
    }

    if (value.payout_overrides) {
      validateDuplicateOverrideEventCodes(value.payout_overrides, context);
    }
  });

export const listOfferAssignmentsQuerySchema = z.object({
  status: z.enum(['active', 'paused', 'archived', 'all']).default('all')
});
