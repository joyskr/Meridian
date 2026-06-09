import type { Database, Queryable } from '../../platform/database/database.js';
import type {
  OfferAdvertiserSummaryRecord,
  OfferEventDefinitionRecord,
  OfferRecord,
  OfferStatus,
  OfferWithAdvertiserRecord
} from './offer-types.js';

export class OfferRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: OfferRepository) => Promise<Result>) {
    return this.database.withTransaction((client) =>
      callback(new OfferRepository(transactionalDatabase(client)))
    );
  }

  async createOffer(offer: {
    id: string;
    organizationId: string;
    advertiserId: string;
    name: string;
    normalizedName: string;
    description: string | null;
    trackingSlug: string | null;
    terms: string | null;
    startAt: Date | null;
    endAt: Date | null;
    dailyCap: number | null;
    monthlyCap: number | null;
    overallCap: number | null;
  }) {
    const result = await this.database.query<OfferRecord>(
      `INSERT INTO offers (
         id,
         organization_id,
         advertiser_id,
         name,
         normalized_name,
         description,
         tracking_slug,
         terms,
         start_at,
         end_at,
         daily_cap,
         monthly_cap,
         overall_cap,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       RETURNING id, organization_id, advertiser_id, name, normalized_name, description,
         tracking_slug, terms, start_at, end_at, daily_cap, monthly_cap, overall_cap,
         status, archived_at, created_at, updated_at`,
      [
        offer.id,
        offer.organizationId,
        offer.advertiserId,
        offer.name,
        offer.normalizedName,
        offer.description,
        offer.trackingSlug,
        offer.terms,
        offer.startAt,
        offer.endAt,
        offer.dailyCap,
        offer.monthlyCap,
        offer.overallCap
      ]
    );

    return result.rows[0];
  }

  async listOffers(
    organizationId: string,
    status: OfferStatus | 'all'
  ) {
    const values: unknown[] = [organizationId];
    let statusFilter = '';

    if (status !== 'all') {
      values.push(status);
      statusFilter = 'AND offers.status = $2';
    }

    const result = await this.database.query<OfferWithAdvertiserRecord>(
      `SELECT offers.id,
          offers.organization_id,
          offers.advertiser_id,
          offers.name,
          offers.normalized_name,
          offers.description,
          offers.tracking_slug,
          offers.terms,
          offers.start_at,
          offers.end_at,
          offers.daily_cap,
          offers.monthly_cap,
          offers.overall_cap,
          offers.status,
          offers.archived_at,
          offers.created_at,
          offers.updated_at,
          advertisers.name AS advertiser_name,
          advertisers.status AS advertiser_status
       FROM offers
       INNER JOIN advertisers ON advertisers.id = offers.advertiser_id
       WHERE offers.organization_id = $1
         ${statusFilter}
       ORDER BY offers.created_at DESC, offers.id DESC`,
      values
    );

    return result.rows;
  }

  async findOffer(organizationId: string, offerId: string) {
    const result = await this.database.query<OfferWithAdvertiserRecord>(
      `SELECT offers.id,
          offers.organization_id,
          offers.advertiser_id,
          offers.name,
          offers.normalized_name,
          offers.description,
          offers.tracking_slug,
          offers.terms,
          offers.start_at,
          offers.end_at,
          offers.daily_cap,
          offers.monthly_cap,
          offers.overall_cap,
          offers.status,
          offers.archived_at,
          offers.created_at,
          offers.updated_at,
          advertisers.name AS advertiser_name,
          advertisers.status AS advertiser_status
       FROM offers
       INNER JOIN advertisers ON advertisers.id = offers.advertiser_id
       WHERE offers.organization_id = $1
         AND offers.id = $2
       LIMIT 1`,
      [organizationId, offerId]
    );

    return result.rows[0] ?? null;
  }

  async listOfferEventDefinitions(offerId: string) {
    const result = await this.database.query<OfferEventDefinitionRecord>(
      `SELECT id, offer_id, event_code, event_name, advertiser_payout, created_at, updated_at
       FROM offer_event_definitions
       WHERE offer_id = $1
       ORDER BY created_at ASC, id ASC`,
      [offerId]
    );

    return result.rows;
  }

  async findAdvertiserSummary(organizationId: string, advertiserId: string) {
    const result = await this.database.query<OfferAdvertiserSummaryRecord>(
      `SELECT id, name, status
       FROM advertisers
       WHERE organization_id = $1
         AND id = $2
       LIMIT 1`,
      [organizationId, advertiserId]
    );

    return result.rows[0] ?? null;
  }

  async findActiveDuplicateByNormalizedName(
    organizationId: string,
    advertiserId: string,
    normalizedName: string,
    excludedOfferId: string | null = null
  ) {
    const values: unknown[] = [organizationId, advertiserId, normalizedName];
    let exclusionClause = '';

    if (excludedOfferId) {
      values.push(excludedOfferId);
      exclusionClause = 'AND id <> $4';
    }

    const result = await this.database.query<OfferRecord>(
      `SELECT id, organization_id, advertiser_id, name, normalized_name, description,
          tracking_slug, terms, start_at, end_at, daily_cap, monthly_cap, overall_cap,
          status, archived_at, created_at, updated_at
       FROM offers
       WHERE organization_id = $1
         AND advertiser_id = $2
         AND normalized_name = $3
         AND status <> 'archived'
         ${exclusionClause}
       LIMIT 1`,
      values
    );

    return result.rows[0] ?? null;
  }

  async updateOffer(offer: {
    id: string;
    advertiserId: string;
    name: string;
    normalizedName: string;
    description: string | null;
    trackingSlug: string | null;
    terms: string | null;
    startAt: Date | null;
    endAt: Date | null;
    dailyCap: number | null;
    monthlyCap: number | null;
    overallCap: number | null;
  }) {
    const result = await this.database.query<OfferRecord>(
      `UPDATE offers
       SET advertiser_id = $2,
           name = $3,
           normalized_name = $4,
           description = $5,
           tracking_slug = $6,
           terms = $7,
           start_at = $8,
           end_at = $9,
           daily_cap = $10,
           monthly_cap = $11,
           overall_cap = $12,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, advertiser_id, name, normalized_name, description,
         tracking_slug, terms, start_at, end_at, daily_cap, monthly_cap, overall_cap,
         status, archived_at, created_at, updated_at`,
      [
        offer.id,
        offer.advertiserId,
        offer.name,
        offer.normalizedName,
        offer.description,
        offer.trackingSlug,
        offer.terms,
        offer.startAt,
        offer.endAt,
        offer.dailyCap,
        offer.monthlyCap,
        offer.overallCap
      ]
    );

    return result.rows[0] ?? null;
  }

  async replaceEventDefinitions(
    offerId: string,
    eventDefinitions: Array<{
      id: string;
      eventCode: string;
      eventName: string;
      advertiserPayout: string;
    }>
  ) {
    await this.database.query('DELETE FROM offer_event_definitions WHERE offer_id = $1', [offerId]);

    for (const eventDefinition of eventDefinitions) {
      await this.database.query(
        `INSERT INTO offer_event_definitions (
           id,
           offer_id,
           event_code,
           event_name,
           advertiser_payout
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          eventDefinition.id,
          offerId,
          eventDefinition.eventCode,
          eventDefinition.eventName,
          eventDefinition.advertiserPayout
        ]
      );
    }
  }

  async updateOfferStatus(offerId: string, status: OfferStatus, archivedAt: Date | null) {
    const result = await this.database.query<OfferRecord>(
      `UPDATE offers
       SET status = $2,
           archived_at = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, advertiser_id, name, normalized_name, description,
         tracking_slug, terms, start_at, end_at, daily_cap, monthly_cap, overall_cap,
         status, archived_at, created_at, updated_at`,
      [offerId, status, archivedAt]
    );

    return result.rows[0] ?? null;
  }
}

function transactionalDatabase(client: Queryable): Database {
  return {
    query(queryText, values) {
      return client.query(queryText, values);
    },
    withTransaction() {
      throw new Error('Nested transactions are not supported in offer repository');
    },
    async close() {}
  };
}
