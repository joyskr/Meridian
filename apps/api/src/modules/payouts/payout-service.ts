import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import type { OrganizationActor } from '../memberships/membership-types.js';
import { PayoutRepository } from './payout-repository.js';
import type {
  PayoutBatchStatus,
  PayoutEligibleConversionRecord,
  PayoutWithRelationsRecord
} from './payout-types.js';

export class PayoutService {
  constructor(private readonly repository: PayoutRepository) {}

  async previewBatch(actor: OrganizationActor) {
    ensurePayoutManageAllowed(actor, 'preview');

    const payouts = await this.repository.listEligibleFinalizedConversions(actor.organizationId);

    return {
      preview: presentPreview(payouts)
    };
  }

  async createBatch(actor: OrganizationActor) {
    ensurePayoutManageAllowed(actor, 'create');

    try {
      const batchId = await this.repository.withTransaction(async (repository) => {
        const eligible = await repository.listEligibleFinalizedConversions(actor.organizationId);

        if (eligible.length === 0) {
          throw new AppError(
            'payout_batch_empty',
            'business_rule',
            'No finalized conversions are currently eligible for payout',
            422
          );
        }

        const batch = await repository.createBatch({
          id: createPublicId('pbt'),
          organizationId: actor.organizationId,
          status: 'draft'
        });

        await repository.createPayouts(
          actor.organizationId,
          batch.id,
          eligible.map((conversion) => ({
            id: createPublicId('pay'),
            conversionId: conversion.conversion_id,
            clickId: conversion.click_id,
            offerId: conversion.offer_id,
            offerAssignmentId: conversion.offer_assignment_id,
            publisherId: conversion.publisher_id,
            advertiserId: conversion.advertiser_id,
            eventType: conversion.event_type,
            sourceSurface: conversion.source_surface,
            finalizedAt: conversion.finalized_at,
            advertiserPayout: conversion.advertiser_payout,
            publisherPayout: conversion.publisher_payout,
            publisherPayoutSource: conversion.publisher_payout_source,
            publisherTier: conversion.publisher_tier,
            publisherTierPercent: conversion.publisher_tier_percent,
            assignmentOverrideAmount: conversion.assignment_override_amount
          }))
        );

        await repository.createAuditLog({
          id: createPublicId('aud'),
          organizationId: actor.organizationId,
          actorUserId: actor.user.id,
          actorMembershipId: actor.membership.id,
          action: 'payout_batch_create',
          entityType: 'payout_batch',
          entityId: batch.id,
          details: JSON.stringify({
            status: 'draft',
            payout_count: eligible.length,
            advertiser_payout_total: sumMoney(eligible.map((item) => item.advertiser_payout)),
            publisher_payout_total: sumMoney(eligible.map((item) => item.publisher_payout))
          })
        });

        return batch.id;
      });

      return this.getBatch(actor, batchId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(
          'payout_batch_conflict',
          'conflict',
          'Payout batch creation conflicted with another payout reservation',
          409
        );
      }

      throw error;
    }
  }

  async listBatches(actor: OrganizationActor, status: PayoutBatchStatus | 'all') {
    ensurePayoutReadAllowed(actor);

    const batches = await this.repository.listBatches(actor.organizationId, status);

    return {
      batches: batches.map(presentBatchSummary)
    };
  }

  async getBatch(actor: OrganizationActor, batchId: string) {
    ensurePayoutReadAllowed(actor);

    const batch = await this.requireBatch(actor.organizationId, batchId);
    const payouts = await this.repository.listBatchPayouts(batch.id);

    return {
      batch: presentBatchDetail(batch, payouts)
    };
  }

  async deleteDraftBatch(actor: OrganizationActor, batchId: string) {
    ensurePayoutManageAllowed(actor, 'delete');

    await this.repository.withTransaction(async (repository) => {
      const batch = await this.requireBatchFromRepository(repository, actor.organizationId, batchId);

      if (batch.status !== 'draft') {
        throw new AppError(
          'payout_batch_delete_invalid_state',
          'business_rule',
          'Only draft payout batches may be deleted',
          422
        );
      }

      await repository.createAuditLog({
        id: createPublicId('aud'),
        organizationId: actor.organizationId,
        actorUserId: actor.user.id,
        actorMembershipId: actor.membership.id,
        action: 'payout_batch_delete',
        entityType: 'payout_batch',
        entityId: batch.id,
        details: JSON.stringify({
          status: batch.status,
          payout_count: batch.payout_count,
          advertiser_payout_total: normalizeMoney(batch.advertiser_payout_total),
          publisher_payout_total: normalizeMoney(batch.publisher_payout_total)
        })
      });

      await repository.deleteDraftBatch(batch.id);
    });
  }

  async approveBatch(actor: OrganizationActor, batchId: string) {
    ensurePayoutManageAllowed(actor, 'approve');

    const batch = await this.requireBatch(actor.organizationId, batchId);

    if (batch.status === 'approved') {
      return this.getBatch(actor, batch.id);
    }

    if (batch.status !== 'draft') {
      throw new AppError(
        'payout_batch_approve_invalid_state',
        'business_rule',
        'Only draft payout batches may be approved',
        422
      );
    }

    await this.repository.withTransaction(async (repository) => {
      await repository.approveBatch(batch.id, new Date());
      await repository.createAuditLog({
        id: createPublicId('aud'),
        organizationId: actor.organizationId,
        actorUserId: actor.user.id,
        actorMembershipId: actor.membership.id,
        action: 'payout_batch_approve',
        entityType: 'payout_batch',
        entityId: batch.id,
        details: JSON.stringify({
          previous_status: batch.status,
          next_status: 'approved'
        })
      });
    });

    return this.getBatch(actor, batch.id);
  }

  async exportBatch(actor: OrganizationActor, batchId: string) {
    ensurePayoutManageAllowed(actor, 'export');

    const batch = await this.requireBatch(actor.organizationId, batchId);

    if (batch.status === 'exported') {
      return this.getBatch(actor, batch.id);
    }

    if (batch.status !== 'approved') {
      throw new AppError(
        'payout_batch_export_invalid_state',
        'business_rule',
        'Only approved payout batches may be exported',
        422
      );
    }

    await this.repository.withTransaction(async (repository) => {
      await repository.exportBatch(batch.id, new Date());
      await repository.createAuditLog({
        id: createPublicId('aud'),
        organizationId: actor.organizationId,
        actorUserId: actor.user.id,
        actorMembershipId: actor.membership.id,
        action: 'payout_batch_export',
        entityType: 'payout_batch',
        entityId: batch.id,
        details: JSON.stringify({
          previous_status: batch.status,
          next_status: 'exported'
        })
      });
    });

    return this.getBatch(actor, batch.id);
  }

  async reconcileBatch(actor: OrganizationActor, batchId: string) {
    ensurePayoutManageAllowed(actor, 'reconcile');

    const batch = await this.requireBatch(actor.organizationId, batchId);

    if (batch.status === 'reconciled') {
      return this.getBatch(actor, batch.id);
    }

    if (batch.status !== 'exported') {
      throw new AppError(
        'payout_batch_reconcile_invalid_state',
        'business_rule',
        'Only exported payout batches may be reconciled',
        422
      );
    }

    await this.repository.withTransaction(async (repository) => {
      await repository.reconcileBatch(batch.id, new Date());
      await repository.createAuditLog({
        id: createPublicId('aud'),
        organizationId: actor.organizationId,
        actorUserId: actor.user.id,
        actorMembershipId: actor.membership.id,
        action: 'payout_batch_reconcile',
        entityType: 'payout_batch',
        entityId: batch.id,
        details: JSON.stringify({
          previous_status: batch.status,
          next_status: 'reconciled'
        })
      });
    });

    return this.getBatch(actor, batch.id);
  }

  async listPayouts(actor: OrganizationActor, filters: { batchId?: string }) {
    ensurePayoutReadAllowed(actor);

    const payouts = await this.repository.listPayouts(actor.organizationId, filters);

    return {
      payouts: payouts.map(presentPayoutSummary)
    };
  }

  async getPayout(actor: OrganizationActor, payoutId: string) {
    ensurePayoutReadAllowed(actor);

    const payout = await this.repository.findPayout(actor.organizationId, payoutId);

    if (!payout) {
      throw new AppError('payout_not_found', 'not_found', 'Payout not found', 404);
    }

    return {
      payout: presentPayoutDetail(payout)
    };
  }

  private async requireBatch(organizationId: string, batchId: string) {
    const batch = await this.repository.findBatchSummary(organizationId, batchId);

    if (!batch) {
      throw new AppError('payout_batch_not_found', 'not_found', 'Payout batch not found', 404);
    }

    return batch;
  }

  private async requireBatchFromRepository(
    repository: PayoutRepository,
    organizationId: string,
    batchId: string
  ) {
    const batch = await repository.findBatchSummary(organizationId, batchId);

    if (!batch) {
      throw new AppError('payout_batch_not_found', 'not_found', 'Payout batch not found', 404);
    }

    return batch;
  }
}

function ensurePayoutReadAllowed(actor: OrganizationActor) {
  if (
    actor.membership.role === 'owner' ||
    actor.membership.role === 'admin' ||
    actor.membership.role === 'manager' ||
    actor.membership.role === 'analyst'
  ) {
    return;
  }

  throw new AppError(
    'payout_read_forbidden',
    'authorization',
    'Current membership cannot read payouts',
    403
  );
}

function ensurePayoutManageAllowed(
  actor: OrganizationActor,
  action: 'preview' | 'create' | 'delete' | 'approve' | 'export' | 'reconcile'
) {
  if (actor.membership.role === 'owner' || actor.membership.role === 'admin') {
    return;
  }

  throw new AppError(
    `payout_${action}_forbidden`,
    'authorization',
    'Current membership cannot manage payout batches',
    403
  );
}

function presentPreview(payouts: PayoutEligibleConversionRecord[]) {
  return {
    payout_count: payouts.length,
    advertiser_payout_total: sumMoney(payouts.map((payout) => payout.advertiser_payout)),
    publisher_payout_total: sumMoney(payouts.map((payout) => payout.publisher_payout)),
    payouts: payouts.map(presentPreviewItem)
  };
}

function presentPreviewItem(payout: PayoutEligibleConversionRecord) {
  return {
    conversion_id: payout.conversion_id,
    click_id: payout.click_id,
    offer: {
      id: payout.offer_id,
      name: payout.offer_name
    },
    assignment: {
      id: payout.offer_assignment_id
    },
    publisher: {
      id: payout.publisher_id,
      name: payout.publisher_name
    },
    advertiser: {
      id: payout.advertiser_id,
      name: payout.advertiser_name
    },
    event_type: payout.event_type,
    source_surface: payout.source_surface,
    finalized_at: payout.finalized_at.toISOString(),
    financial_snapshot: {
      advertiser_payout: normalizeMoney(payout.advertiser_payout),
      publisher_payout: normalizeMoney(payout.publisher_payout),
      publisher_payout_source: payout.publisher_payout_source,
      publisher_tier: payout.publisher_tier,
      publisher_tier_percent: payout.publisher_tier_percent,
      assignment_override_amount: presentMoney(payout.assignment_override_amount)
    }
  };
}

function presentBatchSummary(batch: {
  id: string;
  status: PayoutBatchStatus;
  payout_count: number;
  advertiser_payout_total: string;
  publisher_payout_total: string;
  created_at: Date;
  approved_at: Date | null;
  exported_at: Date | null;
  reconciled_at: Date | null;
}) {
  return {
    id: batch.id,
    status: batch.status,
    payout_count: batch.payout_count,
    advertiser_payout_total: normalizeMoney(batch.advertiser_payout_total),
    publisher_payout_total: normalizeMoney(batch.publisher_payout_total),
    created_at: batch.created_at.toISOString(),
    approved_at: batch.approved_at ? batch.approved_at.toISOString() : null,
    exported_at: batch.exported_at ? batch.exported_at.toISOString() : null,
    reconciled_at: batch.reconciled_at ? batch.reconciled_at.toISOString() : null
  };
}

function presentBatchDetail(
  batch: {
    id: string;
    status: PayoutBatchStatus;
    payout_count: number;
    advertiser_payout_total: string;
    publisher_payout_total: string;
    created_at: Date;
    approved_at: Date | null;
    exported_at: Date | null;
    reconciled_at: Date | null;
  },
  payouts: PayoutWithRelationsRecord[]
) {
  return {
    ...presentBatchSummary(batch),
    payouts: payouts.map(presentPayoutDetail)
  };
}

function presentPayoutSummary(payout: PayoutWithRelationsRecord) {
  return {
    id: payout.id,
    batch_id: payout.batch_id,
    batch_status: payout.batch_status,
    conversion_id: payout.conversion_id,
    click_id: payout.click_id,
    offer: {
      id: payout.offer_id,
      name: payout.offer_name
    },
    assignment: {
      id: payout.offer_assignment_id
    },
    publisher: {
      id: payout.publisher_id,
      name: payout.publisher_name
    },
    advertiser: {
      id: payout.advertiser_id,
      name: payout.advertiser_name
    },
    event_type: payout.event_type,
    source_surface: payout.source_surface,
    finalized_at: payout.finalized_at.toISOString(),
    advertiser_payout: normalizeMoney(payout.advertiser_payout),
    publisher_payout: normalizeMoney(payout.publisher_payout),
    created_at: payout.created_at.toISOString()
  };
}

function presentPayoutDetail(payout: PayoutWithRelationsRecord) {
  return {
    ...presentPayoutSummary(payout),
    publisher_payout_source: payout.publisher_payout_source,
    publisher_tier: payout.publisher_tier,
    publisher_tier_percent: payout.publisher_tier_percent,
    assignment_override_amount: presentMoney(payout.assignment_override_amount)
  };
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function sumMoney(values: string[]) {
  const cents = values.reduce((sum, value) => sum + moneyToCents(value), 0);
  return centsToMoney(cents);
}

function normalizeMoney(value: string | number) {
  return centsToMoney(moneyToCents(value));
}

function presentMoney(value: string | number | null) {
  return value == null ? null : normalizeMoney(value);
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
