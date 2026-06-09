import type { Database, Queryable } from '../../platform/database/database.js';
import type {
  ConversionAdvertiserSourceRecord,
  ConversionAuditLogRecord,
  ConversionClickLookupRecord,
  ConversionFinalizationContextRecord,
  ConversionOfferEventDefinitionRecord,
  ConversionPayoutReservationRecord,
  ConversionRecord,
  ConversionWithRelationsRecord,
  PersistedConversionRejectionReason,
  PublisherPayoutSource
} from './conversion-types.js';

export class ConversionRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: ConversionRepository) => Promise<Result>) {
    return this.database.withTransaction((client) =>
      callback(new ConversionRepository(transactionalDatabase(client)))
    );
  }

  async findAdvertiserSource(advertiserId: string) {
    const result = await this.database.query<ConversionAdvertiserSourceRecord>(
      `SELECT id, organization_id, name, status
       FROM advertisers
       WHERE id = $1
       LIMIT 1`,
      [advertiserId]
    );

    return result.rows[0] ?? null;
  }

  async findExistingByExternalEventId(advertiserId: string, externalEventId: string) {
    const result = await this.database.query<ConversionRecord>(
      `${baseConversionSelect()}
       FROM conversions
       WHERE advertiser_id = $1
         AND external_event_id = $2
       LIMIT 1`,
      [advertiserId, externalEventId]
    );

    return result.rows[0] ?? null;
  }

  async findExistingByIdempotencyKey(advertiserId: string, idempotencyKey: string) {
    const result = await this.database.query<ConversionRecord>(
      `${baseConversionSelect()}
       FROM conversions
       WHERE advertiser_id = $1
         AND idempotency_key = $2
       LIMIT 1`,
      [advertiserId, idempotencyKey]
    );

    return result.rows[0] ?? null;
  }

  async findClickById(clickId: string) {
    const result = await this.database.query<ConversionClickLookupRecord>(
      `SELECT id, organization_id, offer_assignment_id, offer_id, publisher_id, advertiser_id
       FROM clicks
       WHERE id = $1
       LIMIT 1`,
      [clickId]
    );

    return result.rows[0] ?? null;
  }

  async findClicksByAttributionField(
    advertiserId: string,
    fieldName:
      | 'attribution_sub1'
      | 'attribution_sub2'
      | 'attribution_sub3'
      | 'attribution_sub4'
      | 'attribution_sub5',
    value: string
  ) {
    const result = await this.database.query<ConversionClickLookupRecord>(
      `SELECT id, organization_id, offer_assignment_id, offer_id, publisher_id, advertiser_id
       FROM clicks
       WHERE advertiser_id = $1
         AND ${fieldName} = $2
       ORDER BY clicked_at DESC, id DESC
       LIMIT 2`,
      [advertiserId, value]
    );

    return result.rows;
  }

  async findOfferEventDefinition(offerId: string, eventType: string) {
    const result = await this.database.query<ConversionOfferEventDefinitionRecord>(
      `SELECT offer_id, event_code, event_name, advertiser_payout
       FROM offer_event_definitions
       WHERE offer_id = $1
         AND event_code = $2
       LIMIT 1`,
      [offerId, eventType]
    );

    return result.rows[0] ?? null;
  }

  async findFinalizationContext(offerAssignmentId: string, eventType: string) {
    const result = await this.database.query<ConversionFinalizationContextRecord>(
      `SELECT offer_assignments.organization_id,
          offer_assignments.id AS offer_assignment_id,
          offer_assignments.offer_id,
          offer_assignments.publisher_id,
          offers.advertiser_id,
          publishers.publisher_tier,
          tier_settings.payout_percent AS publisher_tier_percent,
          publishers.publisher_postback_percent,
          offer_assignments.postback_percent AS assignment_postback_percent,
          offer_assignments.conversion_visibility_percent,
          overrides.publisher_payout_amount AS assignment_override_amount
       FROM offer_assignments
       INNER JOIN offers ON offers.id = offer_assignments.offer_id
       INNER JOIN publishers ON publishers.id = offer_assignments.publisher_id
       INNER JOIN organization_publisher_tier_settings AS tier_settings
         ON tier_settings.organization_id = offer_assignments.organization_id
        AND tier_settings.tier = publishers.publisher_tier
       LEFT JOIN offer_assignment_payout_overrides AS overrides
         ON overrides.offer_assignment_id = offer_assignments.id
        AND overrides.event_code = $2
       WHERE offer_assignments.id = $1
       LIMIT 1`,
      [offerAssignmentId, eventType]
    );

    return result.rows[0] ?? null;
  }

  async createConversion(conversion: {
    id: string;
    organizationId: string;
    advertiserId: string;
    offerAssignmentId: string | null;
    clickId: string | null;
    offerId: string | null;
    publisherId: string | null;
    sourceSurface: 'ingest' | 'gpixel' | 'goal';
    eventType: string;
    externalEventId: string | null;
    idempotencyKey: string | null;
    lookupClickId: string | null;
    lookupSub1: string | null;
    lookupSub2: string | null;
    lookupSub3: string | null;
    lookupSub4: string | null;
    lookupSub5: string | null;
    status: 'received' | 'rejected' | 'finalized';
    rejectionReason: PersistedConversionRejectionReason | null;
    occurredAt: Date | null;
    receivedAt: Date;
    finalizedAt: Date | null;
    advertiserPayout?: string | null;
    publisherPayout?: string | null;
    publisherPayoutSource?: PublisherPayoutSource | null;
    publisherTier?: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | null;
    publisherTierPercent?: number | null;
    assignmentOverrideAmount?: string | null;
    conversionVisibilityPercent?: number | null;
    conversionVisibleToPublisher?: boolean | null;
    publisherPostbackPercent?: number | null;
    assignmentPostbackPercent?: number | null;
    effectivePostbackPercent?: number | null;
    postbackEligible?: boolean | null;
  }) {
    const result = await this.database.query<ConversionRecord>(
      `INSERT INTO conversions (
         id,
         organization_id,
         advertiser_id,
         offer_assignment_id,
         click_id,
         offer_id,
         publisher_id,
         source_surface,
         event_type,
         external_event_id,
         idempotency_key,
         lookup_click_id,
         lookup_sub1,
         lookup_sub2,
         lookup_sub3,
         lookup_sub4,
         lookup_sub5,
         status,
         rejection_reason,
         occurred_at,
         received_at,
         finalized_at,
         advertiser_payout,
         publisher_payout,
         publisher_payout_source,
         publisher_tier,
         publisher_tier_percent,
         assignment_override_amount,
         conversion_visibility_percent,
         conversion_visible_to_publisher,
         publisher_postback_percent,
         assignment_postback_percent,
         effective_postback_percent,
         postback_eligible
       )
       VALUES (
         $1, $2, $3, CAST($4 AS TEXT), CAST($5 AS TEXT), CAST($6 AS TEXT), CAST($7 AS TEXT),
         $8, $9, CAST($10 AS TEXT), CAST($11 AS TEXT), CAST($12 AS TEXT), CAST($13 AS TEXT),
         CAST($14 AS TEXT), CAST($15 AS TEXT), CAST($16 AS TEXT), CAST($17 AS TEXT), $18,
         CAST($19 AS TEXT), CAST($20 AS TIMESTAMPTZ), CAST($21 AS TIMESTAMPTZ),
         CAST($22 AS TIMESTAMPTZ), CAST($23 AS NUMERIC), CAST($24 AS NUMERIC), CAST($25 AS TEXT),
         CAST($26 AS TEXT), CAST($27 AS INTEGER), CAST($28 AS NUMERIC), CAST($29 AS INTEGER),
         CAST($30 AS BOOLEAN), CAST($31 AS INTEGER), CAST($32 AS INTEGER), CAST($33 AS INTEGER),
         CAST($34 AS BOOLEAN)
       )
       RETURNING ${baseConversionColumns()}`,
      [
        conversion.id,
        conversion.organizationId,
        conversion.advertiserId,
        conversion.offerAssignmentId,
        conversion.clickId,
        conversion.offerId,
        conversion.publisherId,
        conversion.sourceSurface,
        conversion.eventType,
        conversion.externalEventId,
        conversion.idempotencyKey,
        conversion.lookupClickId,
        conversion.lookupSub1,
        conversion.lookupSub2,
        conversion.lookupSub3,
        conversion.lookupSub4,
        conversion.lookupSub5,
        conversion.status,
        conversion.rejectionReason,
        conversion.occurredAt,
        conversion.receivedAt,
        conversion.finalizedAt,
        conversion.advertiserPayout ?? null,
        conversion.publisherPayout ?? null,
        conversion.publisherPayoutSource ?? null,
        conversion.publisherTier ?? null,
        conversion.publisherTierPercent ?? null,
        conversion.assignmentOverrideAmount ?? null,
        conversion.conversionVisibilityPercent ?? null,
        conversion.conversionVisibleToPublisher ?? null,
        conversion.publisherPostbackPercent ?? null,
        conversion.assignmentPostbackPercent ?? null,
        conversion.effectivePostbackPercent ?? null,
        conversion.postbackEligible ?? null
      ]
    );

    return result.rows[0];
  }

  async updateConversionToRejected(conversion: {
    id: string;
    offerAssignmentId: string | null;
    clickId: string | null;
    offerId: string | null;
    publisherId: string | null;
    rejectionReason: PersistedConversionRejectionReason;
  }) {
    const result = await this.database.query<ConversionRecord>(
      `UPDATE conversions
       SET offer_assignment_id = CAST($2 AS TEXT),
           click_id = CAST($3 AS TEXT),
           offer_id = CAST($4 AS TEXT),
           publisher_id = CAST($5 AS TEXT),
           status = 'rejected',
           rejection_reason = $6,
           finalized_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${baseConversionColumns()}`,
      [
        conversion.id,
        conversion.offerAssignmentId,
        conversion.clickId,
        conversion.offerId,
        conversion.publisherId,
        conversion.rejectionReason
      ]
    );

    return result.rows[0] ?? null;
  }

  async updateConversionToFinalized(conversion: {
    id: string;
    offerAssignmentId: string;
    clickId: string;
    offerId: string;
    publisherId: string;
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
    finalizedAt: Date;
  }) {
    const result = await this.database.query<ConversionRecord>(
      `UPDATE conversions
       SET offer_assignment_id = $2,
           click_id = $3,
           offer_id = $4,
           publisher_id = $5,
           status = 'finalized',
           rejection_reason = NULL,
           advertiser_payout = CAST($6 AS NUMERIC),
           publisher_payout = CAST($7 AS NUMERIC),
           publisher_payout_source = $8,
           publisher_tier = $9,
           publisher_tier_percent = $10,
           assignment_override_amount = CAST($11 AS NUMERIC),
           conversion_visibility_percent = $12,
           conversion_visible_to_publisher = $13,
           publisher_postback_percent = $14,
           assignment_postback_percent = $15,
           effective_postback_percent = $16,
           postback_eligible = $17,
           finalized_at = $18,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${baseConversionColumns()}`,
      [
        conversion.id,
        conversion.offerAssignmentId,
        conversion.clickId,
        conversion.offerId,
        conversion.publisherId,
        conversion.advertiserPayout,
        conversion.publisherPayout,
        conversion.publisherPayoutSource,
        conversion.publisherTier,
        conversion.publisherTierPercent,
        conversion.assignmentOverrideAmount,
        conversion.conversionVisibilityPercent,
        conversion.conversionVisibleToPublisher,
        conversion.publisherPostbackPercent,
        conversion.assignmentPostbackPercent,
        conversion.effectivePostbackPercent,
        conversion.postbackEligible,
        conversion.finalizedAt
      ]
    );

    return result.rows[0] ?? null;
  }

  async listConversions(
    organizationId: string,
    filters: {
      status?: 'received' | 'finalized' | 'rejected' | 'all';
      advertiserId?: string;
      offerId?: string;
      publisherId?: string;
      clickId?: string;
    }
  ) {
    const values: unknown[] = [organizationId];
    const whereClauses = ['conversions.organization_id = $1'];

    if (filters.status && filters.status !== 'all') {
      values.push(filters.status);
      whereClauses.push(`conversions.status = $${values.length}`);
    }

    if (filters.advertiserId) {
      values.push(filters.advertiserId);
      whereClauses.push(`conversions.advertiser_id = $${values.length}`);
    }

    if (filters.offerId) {
      values.push(filters.offerId);
      whereClauses.push(`conversions.offer_id = $${values.length}`);
    }

    if (filters.publisherId) {
      values.push(filters.publisherId);
      whereClauses.push(`conversions.publisher_id = $${values.length}`);
    }

    if (filters.clickId) {
      values.push(filters.clickId);
      whereClauses.push(`conversions.click_id = $${values.length}`);
    }

    const result = await this.database.query<ConversionWithRelationsRecord>(
      `${baseConversionSelect('conversions')},
          advertisers.name AS advertiser_name,
          offers.name AS offer_name,
          publishers.name AS publisher_name
       FROM conversions
       INNER JOIN advertisers ON advertisers.id = conversions.advertiser_id
       LEFT JOIN offers ON offers.id = conversions.offer_id
       LEFT JOIN publishers ON publishers.id = conversions.publisher_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY conversions.received_at DESC, conversions.id DESC`,
      values
    );

    return result.rows;
  }

  async findConversion(organizationId: string, conversionId: string) {
    const result = await this.database.query<ConversionWithRelationsRecord>(
      `${baseConversionSelect('conversions')},
          advertisers.name AS advertiser_name,
          offers.name AS offer_name,
          publishers.name AS publisher_name
       FROM conversions
       INNER JOIN advertisers ON advertisers.id = conversions.advertiser_id
       LEFT JOIN offers ON offers.id = conversions.offer_id
       LEFT JOIN publishers ON publishers.id = conversions.publisher_id
       WHERE conversions.organization_id = $1
         AND conversions.id = $2
       LIMIT 1`,
      [organizationId, conversionId]
    );

    return result.rows[0] ?? null;
  }

  async findPayoutReservationByConversionId(conversionId: string) {
    const result = await this.database.query<ConversionPayoutReservationRecord>(
      `SELECT payouts.id AS payout_id,
          payouts.batch_id,
          payout_batches.status AS batch_status
       FROM payouts
       INNER JOIN payout_batches ON payout_batches.id = payouts.batch_id
       WHERE payouts.conversion_id = $1
       LIMIT 1`,
      [conversionId]
    );

    return result.rows[0] ?? null;
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
    const result = await this.database.query<ConversionAuditLogRecord>(
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

function baseConversionSelect(tableAlias?: string) {
  return `SELECT ${baseConversionColumns(tableAlias)}`;
}

function baseConversionColumns(tableAlias?: string) {
  const prefix = tableAlias ? `${tableAlias}.` : '';

  return `${prefix}id,
         ${prefix}organization_id,
         ${prefix}advertiser_id,
         ${prefix}offer_assignment_id,
         ${prefix}click_id,
         ${prefix}offer_id,
         ${prefix}publisher_id,
         ${prefix}source_surface,
         ${prefix}event_type,
         ${prefix}external_event_id,
         ${prefix}idempotency_key,
         ${prefix}lookup_click_id,
         ${prefix}lookup_sub1,
         ${prefix}lookup_sub2,
         ${prefix}lookup_sub3,
         ${prefix}lookup_sub4,
         ${prefix}lookup_sub5,
         ${prefix}status,
         ${prefix}rejection_reason,
         ${prefix}occurred_at,
         ${prefix}received_at,
         ${prefix}finalized_at,
         ${prefix}advertiser_payout,
         ${prefix}publisher_payout,
         ${prefix}publisher_payout_source,
         ${prefix}publisher_tier,
         ${prefix}publisher_tier_percent,
         ${prefix}assignment_override_amount,
         ${prefix}conversion_visibility_percent,
         ${prefix}conversion_visible_to_publisher,
         ${prefix}publisher_postback_percent,
         ${prefix}assignment_postback_percent,
         ${prefix}effective_postback_percent,
         ${prefix}postback_eligible,
         ${prefix}created_at,
         ${prefix}updated_at`;
}

function transactionalDatabase(client: Queryable): Database {
  return {
    query(queryText, values) {
      return client.query(queryText, values);
    },
    withTransaction() {
      throw new Error('Nested transactions are not supported in conversion repository');
    },
    async close() {}
  };
}
