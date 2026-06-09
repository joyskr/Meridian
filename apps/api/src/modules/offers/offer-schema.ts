import { z } from 'zod';

const eventCodePattern = /^[a-z][a-z0-9_]{0,39}$/;
const trackingSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalTrimmedString = z.string().trim().max(4000).transform(emptyToNull).nullable().optional();
const optionalTrackingSlug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(trackingSlugPattern, 'Tracking slug must use lowercase letters, numbers, and hyphens only')
  .transform((value) => value.toLowerCase())
  .nullable()
  .optional();
const optionalIsoDateTime = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime')
  .nullable()
  .optional();
const optionalNonNegativeInteger = z.number().int().nonnegative().nullable().optional();
const payoutAmount = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Advertiser payout must be a non-negative amount with up to 2 decimals')
  .refine((value) => Number(value) > 0, 'Advertiser payout must be greater than 0');

const offerEventDefinitionSchema = z.object({
  event_code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(eventCodePattern, 'Event code must start with a letter and use lowercase letters, numbers, or underscores')
    .transform((value) => value.toLowerCase()),
  event_name: z.string().trim().min(1).max(120),
  advertiser_payout: payoutAmount
});

export const createOfferSchema = z
  .object({
    advertiser_id: z.string().trim().min(1),
    name: z.string().trim().min(1).max(160),
    description: optionalTrimmedString,
    tracking_slug: optionalTrackingSlug,
    terms: optionalTrimmedString,
    start_at: optionalIsoDateTime,
    end_at: optionalIsoDateTime,
    daily_cap: optionalNonNegativeInteger,
    monthly_cap: optionalNonNegativeInteger,
    overall_cap: optionalNonNegativeInteger,
    event_definitions: z.array(offerEventDefinitionSchema).max(25)
  })
  .superRefine((value, context) => {
    validateOfferWindow(value.start_at, value.end_at, context);
    validateDuplicateEventCodes(value.event_definitions, context);
  });

export const updateOfferSchema = z
  .object({
    advertiser_id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).max(160).optional(),
    description: optionalTrimmedString,
    tracking_slug: optionalTrackingSlug,
    terms: optionalTrimmedString,
    start_at: optionalIsoDateTime,
    end_at: optionalIsoDateTime,
    daily_cap: optionalNonNegativeInteger,
    monthly_cap: optionalNonNegativeInteger,
    overall_cap: optionalNonNegativeInteger,
    event_definitions: z.array(offerEventDefinitionSchema).max(25).optional()
  })
  .superRefine((value, context) => {
    if (
      value.advertiser_id === undefined &&
      value.name === undefined &&
      value.description === undefined &&
      value.tracking_slug === undefined &&
      value.terms === undefined &&
      value.start_at === undefined &&
      value.end_at === undefined &&
      value.daily_cap === undefined &&
      value.monthly_cap === undefined &&
      value.overall_cap === undefined &&
      value.event_definitions === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'At least one field must be provided',
        path: []
      });
    }

    validateOfferWindow(value.start_at, value.end_at, context);

    if (value.event_definitions) {
      validateDuplicateEventCodes(value.event_definitions, context);
    }
  });

export const listOffersQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived', 'all']).default('all')
});

function emptyToNull(value: string) {
  return value.length === 0 ? null : value;
}

function validateOfferWindow(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  context: z.RefinementCtx
) {
  if (!startAt || !endAt) {
    return;
  }

  if (Date.parse(startAt) > Date.parse(endAt)) {
    context.addIssue({
      code: 'custom',
      message: 'Offer start date must be before or equal to end date',
      path: ['end_at']
    });
  }
}

function validateDuplicateEventCodes(
  eventDefinitions: Array<{ event_code: string }>,
  context: z.RefinementCtx
) {
  const seen = new Set<string>();

  for (const [index, definition] of eventDefinitions.entries()) {
    if (seen.has(definition.event_code)) {
      context.addIssue({
        code: 'custom',
        message: 'Event code must be unique within the offer',
        path: ['event_definitions', index, 'event_code']
      });
      continue;
    }

    seen.add(definition.event_code);
  }
}
