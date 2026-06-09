import type { Database, Queryable } from '../../platform/database/database.js';
import type {
  PayoutAuditLogRecord,
  PayoutBatchRecord,
  PayoutBatchSummaryRecord,
  PayoutEligibleConversionRecord,
  PayoutWithRelationsRecord
} from './payout-types.js';

export class PayoutRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: PayoutRepository) => Promise<Result>) {
    return this.database.withTransaction((client) =>
      callback(new PayoutRepository(transactionalDatabase(client)))
    );
  }

  async listEligibleFinalizedConversions(organizationId: string) {
    const result = await this.database.query<PayoutEligibleConversionRecord>(
      `SELECT conversions.id AS conversion_id,
          conversions.click_id,
          conversions.offer_id,
          conversions.offer_assignment_id,
          conversions.publisher_id,
          conversions.advertiser_id,
          conversions.event_type,
          conversions.source_surface,
          conversions.finalized_at,
          conversions.advertiser_payout::text AS advertiser_payout,
          conversions.publisher_payout::text AS publisher_payout,
          conversions.publisher_payout_source,
          conversions.publisher_tier,
          conversions.publisher_tier_percent,
          conversions.assignment_override_amount::text AS assignment_override_amount,
          advertisers.name AS advertiser_name,
          offers.name AS offer_name,
          publishers.name AS publisher_name
       FROM conversions
       INNER JOIN advertisers ON advertisers.id = conversions.advertiser_id
       INNER JOIN offers ON offers.id = conversions.offer_id
       INNER JOIN publishers ON publishers.id = conversions.publisher_id
       WHERE conversions.organization_id = $1
         AND conversions.status = 'finalized'
       ORDER BY conversions.finalized_at ASC, conversions.id ASC`,
      [organizationId]
    );

    const eligible: PayoutEligibleConversionRecord[] = [];

    for (const row of result.rows) {
      if (
        !row.click_id ||
        !row.offer_id ||
        !row.offer_assignment_id ||
        !row.publisher_id ||
        !row.finalized_at
      ) {
        continue;
      }

      const payout = await this.findPayoutRowByConversionId(row.conversion_id);

      if (!payout) {
        eligible.push(row);
      }
    }

    return eligible;
  }

  async createBatch(batch: {
    id: string;
    organizationId: string;
    status: 'draft';
  }) {
    const result = await this.database.query<PayoutBatchRecord>(
      `INSERT INTO payout_batches (id, organization_id, status)
       VALUES ($1, $2, $3)
       RETURNING id, organization_id, status, approved_at, exported_at, reconciled_at, created_at, updated_at`,
      [batch.id, batch.organizationId, batch.status]
    );

    return result.rows[0];
  }

  async createPayouts(
    organizationId: string,
    batchId: string,
    payouts: Array<{
      id: string;
      conversionId: string;
      clickId: string;
      offerId: string;
      offerAssignmentId: string;
      publisherId: string;
      advertiserId: string;
      eventType: string;
      sourceSurface: 'ingest' | 'gpixel' | 'goal';
      finalizedAt: Date;
      advertiserPayout: string;
      publisherPayout: string;
      publisherPayoutSource: 'assignment_override' | 'publisher_tier';
      publisherTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
      publisherTierPercent: number;
      assignmentOverrideAmount: string | null;
    }>
  ) {
    for (const payout of payouts) {
      await this.database.query(
        `INSERT INTO payouts (
           id,
           batch_id,
           organization_id,
           conversion_id,
           click_id,
           offer_id,
           offer_assignment_id,
           publisher_id,
           advertiser_id,
           event_type,
           source_surface,
           finalized_at,
           advertiser_payout,
           publisher_payout,
           publisher_payout_source,
           publisher_tier,
           publisher_tier_percent,
           assignment_override_amount
         )
         VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, CAST($13 AS NUMERIC), CAST($14 AS NUMERIC),
           $15, $16, $17, CAST($18 AS NUMERIC)
         )`,
        [
          payout.id,
          batchId,
          organizationId,
          payout.conversionId,
          payout.clickId,
          payout.offerId,
          payout.offerAssignmentId,
          payout.publisherId,
          payout.advertiserId,
          payout.eventType,
          payout.sourceSurface,
          payout.finalizedAt,
          payout.advertiserPayout,
          payout.publisherPayout,
          payout.publisherPayoutSource,
          payout.publisherTier,
          payout.publisherTierPercent,
          payout.assignmentOverrideAmount
        ]
      );
    }
  }

  async listBatches(
    organizationId: string,
    status: 'draft' | 'approved' | 'exported' | 'reconciled' | 'all'
  ) {
    const values: unknown[] = [organizationId];
    const whereClauses = ['payout_batches.organization_id = $1'];

    if (status !== 'all') {
      values.push(status);
      whereClauses.push(`payout_batches.status = $${values.length}`);
    }

    const result = await this.database.query<PayoutBatchSummaryRecord>(
      `${baseBatchSummarySelect()}
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY payout_batches.id,
         payout_batches.organization_id,
         payout_batches.status,
         payout_batches.approved_at,
         payout_batches.exported_at,
         payout_batches.reconciled_at,
         payout_batches.created_at,
         payout_batches.updated_at
       ORDER BY payout_batches.created_at DESC, payout_batches.id DESC`,
      values
    );

    return result.rows;
  }

  async findBatchSummary(organizationId: string, batchId: string) {
    const result = await this.database.query<PayoutBatchSummaryRecord>(
      `${baseBatchSummarySelect()}
       WHERE payout_batches.organization_id = $1
         AND payout_batches.id = $2
       GROUP BY payout_batches.id,
         payout_batches.organization_id,
         payout_batches.status,
         payout_batches.approved_at,
         payout_batches.exported_at,
         payout_batches.reconciled_at,
         payout_batches.created_at,
         payout_batches.updated_at
       LIMIT 1`,
      [organizationId, batchId]
    );

    return result.rows[0] ?? null;
  }

  async listBatchPayouts(batchId: string) {
    const result = await this.database.query<PayoutWithRelationsRecord>(
      `${basePayoutSelect()}
       WHERE payouts.batch_id = $1
       ORDER BY payouts.created_at ASC, payouts.id ASC`,
      [batchId]
    );

    return result.rows;
  }

  async listPayouts(organizationId: string, filters: { batchId?: string }) {
    const values: unknown[] = [organizationId];
    const whereClauses = ['payouts.organization_id = $1'];

    if (filters.batchId) {
      values.push(filters.batchId);
      whereClauses.push(`payouts.batch_id = $${values.length}`);
    }

    const result = await this.database.query<PayoutWithRelationsRecord>(
      `${basePayoutSelect()}
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY payouts.created_at DESC, payouts.id DESC`,
      values
    );

    return result.rows;
  }

  async findPayout(organizationId: string, payoutId: string) {
    const result = await this.database.query<PayoutWithRelationsRecord>(
      `${basePayoutSelect()}
       WHERE payouts.organization_id = $1
         AND payouts.id = $2
       LIMIT 1`,
      [organizationId, payoutId]
    );

    return result.rows[0] ?? null;
  }

  async findPayoutRowByConversionId(conversionId: string) {
    const result = await this.database.query<{ id: string }>(
      `SELECT id
       FROM payouts
       WHERE conversion_id = $1
       LIMIT 1`,
      [conversionId]
    );

    return result.rows[0] ?? null;
  }

  async approveBatch(batchId: string, approvedAt: Date) {
    const result = await this.database.query<PayoutBatchRecord>(
      `UPDATE payout_batches
       SET status = 'approved',
           approved_at = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, status, approved_at, exported_at, reconciled_at, created_at, updated_at`,
      [batchId, approvedAt]
    );

    return result.rows[0] ?? null;
  }

  async exportBatch(batchId: string, exportedAt: Date) {
    const result = await this.database.query<PayoutBatchRecord>(
      `UPDATE payout_batches
       SET status = 'exported',
           exported_at = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, status, approved_at, exported_at, reconciled_at, created_at, updated_at`,
      [batchId, exportedAt]
    );

    return result.rows[0] ?? null;
  }

  async reconcileBatch(batchId: string, reconciledAt: Date) {
    const result = await this.database.query<PayoutBatchRecord>(
      `UPDATE payout_batches
       SET status = 'reconciled',
           reconciled_at = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, status, approved_at, exported_at, reconciled_at, created_at, updated_at`,
      [batchId, reconciledAt]
    );

    return result.rows[0] ?? null;
  }

  async deleteDraftBatch(batchId: string) {
    await this.database.query('DELETE FROM payout_batches WHERE id = $1', [batchId]);
  }

  async createAuditLog(log: {
    id: string;
    organizationId: string;
    actorUserId: string;
    actorMembershipId: string;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
  }) {
    const result = await this.database.query<PayoutAuditLogRecord>(
      `INSERT INTO audit_logs (
         id,
         organization_id,
         actor_user_id,
         actor_membership_id,
         action,
         entity_type,
         entity_id,
         details
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, organization_id, actor_user_id, actor_membership_id, action, entity_type, entity_id, details, created_at`,
      [
        log.id,
        log.organizationId,
        log.actorUserId,
        log.actorMembershipId,
        log.action,
        log.entityType,
        log.entityId,
        log.details
      ]
    );

    return result.rows[0];
  }
}

function baseBatchSummarySelect() {
  return `SELECT payout_batches.id,
      payout_batches.organization_id,
      payout_batches.status,
      payout_batches.approved_at,
      payout_batches.exported_at,
      payout_batches.reconciled_at,
      payout_batches.created_at,
      payout_batches.updated_at,
      COUNT(payouts.id)::int AS payout_count,
      COALESCE(SUM(payouts.advertiser_payout), 0)::text AS advertiser_payout_total,
      COALESCE(SUM(payouts.publisher_payout), 0)::text AS publisher_payout_total
   FROM payout_batches
   LEFT JOIN payouts ON payouts.batch_id = payout_batches.id`;
}

function basePayoutSelect() {
  return `SELECT payouts.id,
      payouts.batch_id,
      payouts.organization_id,
      payouts.conversion_id,
      payouts.click_id,
      payouts.offer_id,
      payouts.offer_assignment_id,
      payouts.publisher_id,
      payouts.advertiser_id,
      payouts.event_type,
      payouts.source_surface,
      payouts.finalized_at,
      payouts.advertiser_payout::text AS advertiser_payout,
      payouts.publisher_payout::text AS publisher_payout,
      payouts.publisher_payout_source,
      payouts.publisher_tier,
      payouts.publisher_tier_percent,
      payouts.assignment_override_amount::text AS assignment_override_amount,
      payouts.created_at,
      payout_batches.status AS batch_status,
      advertisers.name AS advertiser_name,
      offers.name AS offer_name,
      publishers.name AS publisher_name
   FROM payouts
   INNER JOIN payout_batches ON payout_batches.id = payouts.batch_id
   INNER JOIN advertisers ON advertisers.id = payouts.advertiser_id
   INNER JOIN offers ON offers.id = payouts.offer_id
   INNER JOIN publishers ON publishers.id = payouts.publisher_id`;
}

function transactionalDatabase(client: Queryable): Database {
  return {
    query(queryText, values) {
      return client.query(queryText, values);
    },
    withTransaction() {
      throw new Error('Nested transactions are not supported in payout repository');
    },
    async close() {}
  };
}
