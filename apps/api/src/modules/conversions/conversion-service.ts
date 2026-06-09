import { createHash } from 'node:crypto';
import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import type { OrganizationActor } from '../memberships/membership-types.js';
import { ConversionRepository } from './conversion-repository.js';
import type {
  ConversionClickLookupRecord,
  ConversionFinalizationContextRecord,
  ConversionLookupInputs,
  ConversionOfferEventDefinitionRecord,
  ConversionRecord,
  ConversionSourceSurface,
  ConversionWithRelationsRecord,
  NormalizedConversionInput,
  PersistedConversionRejectionReason,
  PublisherPayoutSource
} from './conversion-types.js';

type FinalizedSnapshot = {
  advertiserPayout: string;
  publisherPayout: string;
  publisherPayoutSource: PublisherPayoutSource;
  publisherTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  publisherTierPercent: number;
  assignmentOverrideAmount: string | null;
  conversionVisibilityPercent: number;
  conversionVisibleToPublisher: boolean;
  publisherPostbackPercent: number;
  assignmentPostbackPercent: number;
  effectivePostbackPercent: number;
  postbackEligible: boolean;
};

export class ConversionService {
  constructor(private readonly repository: ConversionRepository) {}

  async ingestConversion(
    sourceSurface: ConversionSourceSurface,
    input: NormalizedConversionInput
  ) {
    return this.repository.withTransaction(async (repository) => {
      const advertiser = await repository.findAdvertiserSource(input.advertiserId);

      if (!advertiser) {
        throw new AppError(
          'conversion_source_invalid',
          'not_found',
          'Advertiser conversion source is invalid',
          404
        );
      }

      const duplicate = await findDuplicateConversion(repository, input);
      if (duplicate) {
        return {
          outcome: 'duplicate' as const,
          conversion: presentPublicConversion(duplicate)
        };
      }

      const received = await repository.createConversion({
        id: createPublicId('cnv'),
        organizationId: advertiser.organization_id,
        advertiserId: advertiser.id,
        offerAssignmentId: null,
        clickId: null,
        offerId: null,
        publisherId: null,
        sourceSurface,
        eventType: input.eventType,
        externalEventId: input.externalEventId,
        idempotencyKey: input.idempotencyKey,
        lookupClickId: input.lookupInputs.click_id,
        lookupSub1: input.lookupInputs.sub1,
        lookupSub2: input.lookupInputs.sub2,
        lookupSub3: input.lookupInputs.sub3,
        lookupSub4: input.lookupInputs.sub4,
        lookupSub5: input.lookupInputs.sub5,
        status: 'received',
        rejectionReason: null,
        occurredAt: input.occurredAt,
        receivedAt: new Date(),
        finalizedAt: null
      });

      const evaluation = await evaluateConversion(repository, received, input);

      if (!evaluation.ok) {
        const rejected = await repository.updateConversionToRejected({
          id: received.id,
          offerAssignmentId: evaluation.click?.offer_assignment_id ?? null,
          clickId: evaluation.click?.id ?? null,
          offerId: evaluation.click?.offer_id ?? null,
          publisherId: evaluation.click?.publisher_id ?? null,
          rejectionReason: evaluation.reason
        });

        if (!rejected) {
          throw new AppError(
            'conversion_rejection_failed',
            'system',
            'Conversion rejection update failed',
            500
          );
        }

        return {
          outcome: 'created' as const,
          conversion: presentPublicConversion(rejected)
        };
      }

      const finalized = await repository.updateConversionToFinalized({
        id: received.id,
        offerAssignmentId: evaluation.click.offer_assignment_id,
        clickId: evaluation.click.id,
        offerId: evaluation.click.offer_id,
        publisherId: evaluation.click.publisher_id,
        advertiserPayout: evaluation.snapshot.advertiserPayout,
        publisherPayout: evaluation.snapshot.publisherPayout,
        publisherPayoutSource: evaluation.snapshot.publisherPayoutSource,
        publisherTier: evaluation.snapshot.publisherTier,
        publisherTierPercent: evaluation.snapshot.publisherTierPercent,
        assignmentOverrideAmount: evaluation.snapshot.assignmentOverrideAmount,
        conversionVisibilityPercent: evaluation.snapshot.conversionVisibilityPercent,
        conversionVisibleToPublisher: evaluation.snapshot.conversionVisibleToPublisher,
        publisherPostbackPercent: evaluation.snapshot.publisherPostbackPercent,
        assignmentPostbackPercent: evaluation.snapshot.assignmentPostbackPercent,
        effectivePostbackPercent: evaluation.snapshot.effectivePostbackPercent,
        postbackEligible: evaluation.snapshot.postbackEligible,
        finalizedAt: new Date()
      });

      if (!finalized) {
        throw new AppError(
          'conversion_finalization_failed',
          'system',
          'Conversion finalization update failed',
          500
        );
      }

      return {
        outcome: 'created' as const,
        conversion: presentPublicConversion(finalized)
      };
    });
  }

  async listConversions(
    actor: OrganizationActor,
    filters: {
      status: 'received' | 'finalized' | 'rejected' | 'all';
      advertiserId?: string;
      offerId?: string;
      publisherId?: string;
      clickId?: string;
    }
  ) {
    ensureConversionReadAllowed(actor);

    const conversions = await this.repository.listConversions(actor.organizationId, filters);

    return {
      conversions: conversions.map(presentConversionListItem)
    };
  }

  async getConversion(actor: OrganizationActor, conversionId: string) {
    ensureConversionReadAllowed(actor);

    const conversion = await this.repository.findConversion(actor.organizationId, conversionId);

    if (!conversion) {
      throw new AppError('conversion_not_found', 'not_found', 'Conversion not found', 404);
    }

    return {
      conversion: presentConversionDetail(conversion)
    };
  }

  async reprocessConversion(actor: OrganizationActor, conversionId: string) {
    ensureConversionReprocessAllowed(actor);

    const result = await this.repository.withTransaction(async (repository) => {
      const existing = await repository.findConversion(actor.organizationId, conversionId);

      if (!existing) {
        throw new AppError('conversion_not_found', 'not_found', 'Conversion not found', 404);
      }

      const payoutReservation = await repository.findPayoutReservationByConversionId(existing.id);

      if (payoutReservation) {
        const snapshot = buildAuditSnapshot(existing);

        await repository.createAuditLog({
          id: createPublicId('aud'),
          organizationId: actor.organizationId,
          actorUserId: actor.user.id,
          actorMembershipId: actor.membership.id,
          action: 'conversion_reprocess',
          entityType: 'conversion',
          entityId: existing.id,
          details: JSON.stringify({
            outcome: 'no_change',
            previous_status: existing.status,
            next_status: existing.status,
            failure_reason: 'payout_locked',
            payout_reservation: payoutReservation,
            previous_snapshot: snapshot,
            next_snapshot: snapshot
          })
        });

        return {
          ok: false as const,
          code: 'conversion_reprocess_blocked_by_payout',
          message:
            'Conversions that already belong to a persisted payout row cannot be manually reprocessed',
          details: {
            batch_id: payoutReservation.batch_id,
            batch_status: payoutReservation.batch_status,
            payout_id: payoutReservation.payout_id
          }
        };
      }

      if (existing.status === 'received') {
        await repository.createAuditLog({
          id: createPublicId('aud'),
          organizationId: actor.organizationId,
          actorUserId: actor.user.id,
          actorMembershipId: actor.membership.id,
          action: 'conversion_reprocess',
          entityType: 'conversion',
          entityId: existing.id,
          details: JSON.stringify({
            outcome: 'no_change',
            previous_status: existing.status,
            next_status: existing.status,
            failure_reason: 'invalid_state',
            previous_snapshot: buildAuditSnapshot(existing),
            next_snapshot: buildAuditSnapshot(existing)
          })
        });

        return {
          ok: false as const,
          code: 'conversion_reprocess_invalid_state',
          message: 'Received conversions cannot be manually reprocessed in MVP',
          details: undefined
        };
      }

      const input: NormalizedConversionInput = {
        advertiserId: existing.advertiser_id,
        eventType: existing.event_type,
        externalEventId: existing.external_event_id,
        idempotencyKey: existing.idempotency_key,
        occurredAt: existing.occurred_at,
        lookupInputs: {
          click_id: existing.lookup_click_id,
          sub1: existing.lookup_sub1,
          sub2: existing.lookup_sub2,
          sub3: existing.lookup_sub3,
          sub4: existing.lookup_sub4,
          sub5: existing.lookup_sub5
        }
      };

      const evaluation = await evaluateConversion(repository, existing, input);
      const previousSnapshot = buildAuditSnapshot(existing);

      if (!evaluation.ok) {
        await repository.createAuditLog({
          id: createPublicId('aud'),
          organizationId: actor.organizationId,
          actorUserId: actor.user.id,
          actorMembershipId: actor.membership.id,
          action: 'conversion_reprocess',
          entityType: 'conversion',
          entityId: existing.id,
          details: JSON.stringify({
            outcome: 'no_change',
            previous_status: existing.status,
            next_status: existing.status,
            failure_reason: evaluation.reason,
            previous_snapshot: previousSnapshot,
            next_snapshot: previousSnapshot
          })
        });

        return {
          ok: false as const,
          code: 'conversion_reprocess_unresolved',
          message: 'Manual reprocessing did not produce a valid finalized conversion',
          details: {
            failure_reason: evaluation.reason
          }
        };
      }

      const finalized = await repository.updateConversionToFinalized({
        id: existing.id,
        offerAssignmentId: evaluation.click.offer_assignment_id,
        clickId: evaluation.click.id,
        offerId: evaluation.click.offer_id,
        publisherId: evaluation.click.publisher_id,
        advertiserPayout: evaluation.snapshot.advertiserPayout,
        publisherPayout: evaluation.snapshot.publisherPayout,
        publisherPayoutSource: evaluation.snapshot.publisherPayoutSource,
        publisherTier: evaluation.snapshot.publisherTier,
        publisherTierPercent: evaluation.snapshot.publisherTierPercent,
        assignmentOverrideAmount: evaluation.snapshot.assignmentOverrideAmount,
        conversionVisibilityPercent: evaluation.snapshot.conversionVisibilityPercent,
        conversionVisibleToPublisher: evaluation.snapshot.conversionVisibleToPublisher,
        publisherPostbackPercent: evaluation.snapshot.publisherPostbackPercent,
        assignmentPostbackPercent: evaluation.snapshot.assignmentPostbackPercent,
        effectivePostbackPercent: evaluation.snapshot.effectivePostbackPercent,
        postbackEligible: evaluation.snapshot.postbackEligible,
        finalizedAt: new Date()
      });

      if (!finalized) {
        throw new AppError(
          'conversion_reprocess_failed',
          'system',
          'Manual reprocessing failed to update the conversion',
          500
        );
      }

      await repository.createAuditLog({
        id: createPublicId('aud'),
        organizationId: actor.organizationId,
        actorUserId: actor.user.id,
        actorMembershipId: actor.membership.id,
        action: 'conversion_reprocess',
        entityType: 'conversion',
        entityId: finalized.id,
        details: JSON.stringify({
          outcome:
            existing.status === 'rejected'
              ? 'rejected_to_finalized'
              : 'finalized_snapshot_replaced',
          previous_status: existing.status,
          next_status: finalized.status,
          previous_snapshot: previousSnapshot,
          next_snapshot: buildAuditSnapshot(finalized)
        })
      });

      const refreshed = await repository.findConversion(actor.organizationId, finalized.id);

      if (!refreshed) {
        throw new AppError(
          'conversion_not_found',
          'not_found',
          'Conversion not found after reprocessing',
          404
        );
      }

      return {
        ok: true as const,
        conversion: presentConversionDetail(refreshed)
      };
    });

    if (!result.ok) {
      throw new AppError(result.code, 'business_rule', result.message, 422, result.details);
    }

    return {
      conversion: result.conversion
    };
  }
}

async function findDuplicateConversion(
  repository: ConversionRepository,
  input: NormalizedConversionInput
) {
  if (input.externalEventId) {
    const duplicateByExternalId = await repository.findExistingByExternalEventId(
      input.advertiserId,
      input.externalEventId
    );

    if (duplicateByExternalId) {
      return duplicateByExternalId;
    }
  }

  if (input.idempotencyKey) {
    return repository.findExistingByIdempotencyKey(input.advertiserId, input.idempotencyKey);
  }

  return null;
}

async function evaluateConversion(
  repository: ConversionRepository,
  conversion: ConversionRecord,
  input: NormalizedConversionInput
): Promise<
  | { ok: true; click: ConversionClickLookupRecord; snapshot: FinalizedSnapshot }
  | {
      ok: false;
      reason: PersistedConversionRejectionReason;
      click?: ConversionClickLookupRecord;
    }
> {
  const lookupResult = await resolveClickLookup(repository, input.advertiserId, input.lookupInputs);

  if (!lookupResult.ok) {
    return lookupResult;
  }

  const click = lookupResult.click;
  const eventDefinition = await repository.findOfferEventDefinition(click.offer_id, input.eventType);

  if (!eventDefinition) {
    return {
      ok: false,
      reason: 'unknown_event_type',
      click
    };
  }

  const finalizationContext = await repository.findFinalizationContext(
    click.offer_assignment_id,
    eventDefinition.event_code
  );

  if (!finalizationContext) {
    throw new AppError(
      'conversion_finalization_context_missing',
      'system',
      'Conversion finalization context is missing',
      500
    );
  }

  return {
    ok: true,
    click,
    snapshot: buildFinalizedSnapshot(conversion.id, finalizationContext, eventDefinition)
  };
}

async function resolveClickLookup(
  repository: ConversionRepository,
  advertiserId: string,
  lookupInputs: ConversionLookupInputs
): Promise<
  | { ok: true; click: ConversionClickLookupRecord }
  | { ok: false; reason: PersistedConversionRejectionReason; click?: ConversionClickLookupRecord }
> {
  if (lookupInputs.click_id) {
    const click = await repository.findClickById(lookupInputs.click_id);

    if (!click) {
      return { ok: false, reason: 'click_not_found' };
    }

    if (click.advertiser_id !== advertiserId) {
      return { ok: false, reason: 'attribution_conflict' };
    }

    const conflict = await ensureSupplementalLookupConsistency(repository, advertiserId, click, lookupInputs, [
      'sub1',
      'sub2',
      'sub3',
      'sub4',
      'sub5'
    ]);

    if (conflict) {
      return { ok: false, reason: 'attribution_conflict', click };
    }

    return { ok: true, click };
  }

  const prioritizedLookups = [
    ['sub1', lookupInputs.sub1],
    ['sub2', lookupInputs.sub2],
    ['sub3', lookupInputs.sub3],
    ['sub4', lookupInputs.sub4],
    ['sub5', lookupInputs.sub5]
  ] as const;

  for (const [field, value] of prioritizedLookups) {
    if (!value) {
      continue;
    }

    const matches = await repository.findClicksByAttributionField(
      advertiserId,
      toAttributionFieldName(field),
      value
    );

    if (matches.length === 0) {
      continue;
    }

    if (matches.length > 1) {
      return { ok: false, reason: 'attribution_conflict' };
    }

    const click = matches[0];
    const lowerPriorityFields = prioritizedLookups
      .filter(([otherField]) => otherField !== field)
      .map(([otherField]) => otherField);
    const conflict = await ensureSupplementalLookupConsistency(
      repository,
      advertiserId,
      click,
      lookupInputs,
      lowerPriorityFields
    );

    if (conflict) {
      return { ok: false, reason: 'attribution_conflict', click };
    }

    return { ok: true, click };
  }

  return { ok: false, reason: 'click_not_found' };
}

async function ensureSupplementalLookupConsistency(
  repository: ConversionRepository,
  advertiserId: string,
  click: ConversionClickLookupRecord,
  lookupInputs: ConversionLookupInputs,
  fields: Array<'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5'>
) {
  for (const field of fields) {
    const value = lookupInputs[field];

    if (!value) {
      continue;
    }

    const matches = await repository.findClicksByAttributionField(
      advertiserId,
      toAttributionFieldName(field),
      value
    );

    if (matches.length !== 1 || matches[0].id !== click.id) {
      return true;
    }
  }

  return false;
}

function toAttributionFieldName(field: 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5') {
  switch (field) {
    case 'sub1':
      return 'attribution_sub1';
    case 'sub2':
      return 'attribution_sub2';
    case 'sub3':
      return 'attribution_sub3';
    case 'sub4':
      return 'attribution_sub4';
    case 'sub5':
      return 'attribution_sub5';
  }
}

function buildFinalizedSnapshot(
  conversionId: string,
  context: ConversionFinalizationContextRecord,
  eventDefinition: ConversionOfferEventDefinitionRecord
): FinalizedSnapshot {
  const advertiserPayout = normalizeMoney(eventDefinition.advertiser_payout);
  const assignmentOverrideAmount = context.assignment_override_amount
    ? normalizeMoney(context.assignment_override_amount)
    : null;
  const publisherPayoutSource: PublisherPayoutSource = assignmentOverrideAmount
    ? 'assignment_override'
    : 'publisher_tier';
  const publisherPayout =
    publisherPayoutSource === 'assignment_override'
      ? assignmentOverrideAmount ?? advertiserPayout
      : applyPercent(advertiserPayout, context.publisher_tier_percent);
  const conversionVisibleToPublisher = evaluateDeterministicPercent(
    conversionId,
    context.offer_assignment_id,
    'visibility',
    context.conversion_visibility_percent
  );
  const effectivePostbackPercent = Math.min(
    context.publisher_postback_percent,
    context.assignment_postback_percent
  );
  const postbackEligible = evaluateDeterministicPercent(
    conversionId,
    context.offer_assignment_id,
    'postback',
    effectivePostbackPercent
  );

  return {
    advertiserPayout,
    publisherPayout,
    publisherPayoutSource,
    publisherTier: context.publisher_tier,
    publisherTierPercent: context.publisher_tier_percent,
    assignmentOverrideAmount,
    conversionVisibilityPercent: context.conversion_visibility_percent,
    conversionVisibleToPublisher,
    publisherPostbackPercent: context.publisher_postback_percent,
    assignmentPostbackPercent: context.assignment_postback_percent,
    effectivePostbackPercent,
    postbackEligible
  };
}

function evaluateDeterministicPercent(
  conversionId: string,
  assignmentId: string,
  dimension: 'visibility' | 'postback',
  percent: number
) {
  if (percent <= 0) {
    return false;
  }

  if (percent >= 100) {
    return true;
  }

  const digest = createHash('sha256')
    .update(`${assignmentId}:${conversionId}:${dimension}`)
    .digest();
  const bucket = digest.readUInt32BE(0) % 100;

  return bucket < percent;
}

function normalizeMoney(value: string | number) {
  return centsToMoney(moneyToCents(value));
}

function applyPercent(amount: string | number, percent: number) {
  const cents = moneyToCents(amount);
  const payoutCents = Math.round((cents * percent) / 100);
  return centsToMoney(payoutCents);
}

function moneyToCents(value: string | number) {
  const normalized = String(value).trim();
  const [wholePart, decimalPart = ''] = normalized.split('.');
  const whole = Number.parseInt(wholePart, 10);
  const decimals = Number.parseInt(decimalPart.padEnd(2, '0').slice(0, 2), 10);
  return whole * 100 + decimals;
}

function centsToMoney(cents: number) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const decimals = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${decimals}`;
}

function ensureConversionReadAllowed(actor: OrganizationActor) {
  if (
    actor.membership.role === 'owner' ||
    actor.membership.role === 'admin' ||
    actor.membership.role === 'manager' ||
    actor.membership.role === 'analyst'
  ) {
    return;
  }

  throw new AppError(
    'conversion_read_forbidden',
    'authorization',
    'Current membership cannot read conversions',
    403
  );
}

function ensureConversionReprocessAllowed(actor: OrganizationActor) {
  if (actor.membership.role === 'owner' || actor.membership.role === 'admin') {
    return;
  }

  throw new AppError(
    'conversion_reprocess_forbidden',
    'authorization',
    'Current membership cannot manually reprocess conversions',
    403
  );
}

function presentPublicConversion(conversion: ConversionRecord) {
  return {
    id: conversion.id,
    advertiser_id: conversion.advertiser_id,
    offer_assignment_id: conversion.offer_assignment_id,
    click_id: conversion.click_id,
    offer_id: conversion.offer_id,
    publisher_id: conversion.publisher_id,
    source_surface: conversion.source_surface,
    event_type: conversion.event_type,
    external_event_id: conversion.external_event_id,
    idempotency_key: conversion.idempotency_key,
    status: conversion.status,
    rejection_reason: conversion.rejection_reason,
    occurred_at: conversion.occurred_at ? conversion.occurred_at.toISOString() : null,
    received_at: conversion.received_at.toISOString(),
    finalized_at: conversion.finalized_at ? conversion.finalized_at.toISOString() : null
  };
}

function presentConversionListItem(conversion: ConversionWithRelationsRecord) {
  return {
    id: conversion.id,
    advertiser: {
      id: conversion.advertiser_id,
      name: conversion.advertiser_name
    },
    offer: conversion.offer_id
      ? {
          id: conversion.offer_id,
          name: conversion.offer_name
        }
      : null,
    publisher: conversion.publisher_id
      ? {
          id: conversion.publisher_id,
          name: conversion.publisher_name
        }
      : null,
    assignment: conversion.offer_assignment_id
      ? {
          id: conversion.offer_assignment_id
        }
      : null,
    click: conversion.click_id
      ? {
          id: conversion.click_id
        }
      : null,
    source_surface: conversion.source_surface,
    event_type: conversion.event_type,
    status: conversion.status,
    rejection_reason: conversion.rejection_reason,
    occurred_at: conversion.occurred_at ? conversion.occurred_at.toISOString() : null,
    received_at: conversion.received_at.toISOString(),
    finalized_at: conversion.finalized_at ? conversion.finalized_at.toISOString() : null
  };
}

function presentConversionDetail(conversion: ConversionWithRelationsRecord) {
  return {
    ...presentConversionListItem(conversion),
    external_event_id: conversion.external_event_id,
    idempotency_key: conversion.idempotency_key,
    lookup_inputs: {
      click_id: conversion.lookup_click_id,
      sub1: conversion.lookup_sub1,
      sub2: conversion.lookup_sub2,
      sub3: conversion.lookup_sub3,
      sub4: conversion.lookup_sub4,
      sub5: conversion.lookup_sub5
    },
    financial_snapshot: {
      advertiser_payout: presentMoney(conversion.advertiser_payout),
      publisher_payout: presentMoney(conversion.publisher_payout),
      publisher_payout_source: conversion.publisher_payout_source,
      publisher_tier: conversion.publisher_tier,
      publisher_tier_percent: conversion.publisher_tier_percent,
      assignment_override_amount: presentMoney(conversion.assignment_override_amount)
    },
    visibility_snapshot: {
      conversion_visibility_percent: conversion.conversion_visibility_percent,
      conversion_visible_to_publisher: conversion.conversion_visible_to_publisher
    },
    postback_snapshot: {
      publisher_postback_percent: conversion.publisher_postback_percent,
      assignment_postback_percent: conversion.assignment_postback_percent,
      effective_postback_percent: conversion.effective_postback_percent,
      postback_eligible: conversion.postback_eligible
    }
  };
}

function buildAuditSnapshot(conversion: ConversionRecord) {
  return {
    status: conversion.status,
    rejection_reason: conversion.rejection_reason,
    offer_assignment_id: conversion.offer_assignment_id,
    click_id: conversion.click_id,
    offer_id: conversion.offer_id,
    publisher_id: conversion.publisher_id,
    advertiser_id: conversion.advertiser_id,
    event_type: conversion.event_type,
    external_event_id: conversion.external_event_id,
    idempotency_key: conversion.idempotency_key,
    source_surface: conversion.source_surface,
    financial_snapshot: {
      advertiser_payout: presentMoney(conversion.advertiser_payout),
      publisher_payout: presentMoney(conversion.publisher_payout),
      publisher_payout_source: conversion.publisher_payout_source,
      publisher_tier: conversion.publisher_tier,
      publisher_tier_percent: conversion.publisher_tier_percent,
      assignment_override_amount: presentMoney(conversion.assignment_override_amount)
    },
    visibility_snapshot: {
      conversion_visibility_percent: conversion.conversion_visibility_percent,
      conversion_visible_to_publisher: conversion.conversion_visible_to_publisher
    },
    postback_snapshot: {
      publisher_postback_percent: conversion.publisher_postback_percent,
      assignment_postback_percent: conversion.assignment_postback_percent,
      effective_postback_percent: conversion.effective_postback_percent,
      postback_eligible: conversion.postback_eligible
    }
  };
}

function presentMoney(value: string | number | null) {
  return value == null ? null : normalizeMoney(value);
}
