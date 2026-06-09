import type { Database, Queryable } from '../../platform/database/database.js';
import type { PublisherTierSettingRecord } from '../publishers/publisher-types.js';
import type {
  OfferAssignmentPayoutOverrideWithEventRecord,
  OfferAssignmentRecord,
  OfferAssignmentStatus,
  OfferAssignmentWithRelationsRecord,
  OfferEventDefinitionForAssignmentRecord,
  OfferSummaryForAssignmentRecord,
  PublisherSummaryForAssignmentRecord
} from './offer-assignment-types.js';

export class OfferAssignmentRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: OfferAssignmentRepository) => Promise<Result>) {
    return this.database.withTransaction((client) =>
      callback(new OfferAssignmentRepository(transactionalDatabase(client)))
    );
  }

  async createAssignment(assignment: {
    id: string;
    organizationId: string;
    offerId: string;
    publisherId: string;
    trackingToken: string;
    redirectUrl: string;
    conversionVisibilityPercent: number;
    postbackPercent: number;
  }) {
    const result = await this.database.query<OfferAssignmentRecord>(
      `INSERT INTO offer_assignments (
         id,
         organization_id,
         offer_id,
         publisher_id,
         tracking_token,
         redirect_url,
         conversion_visibility_percent,
         postback_percent,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, organization_id, offer_id, publisher_id, tracking_token, redirect_url,
         conversion_visibility_percent, postback_percent, status, archived_at, created_at, updated_at`,
      [
        assignment.id,
        assignment.organizationId,
        assignment.offerId,
        assignment.publisherId,
        assignment.trackingToken,
        assignment.redirectUrl,
        assignment.conversionVisibilityPercent,
        assignment.postbackPercent
      ]
    );

    return result.rows[0];
  }

  async listAssignments(
    organizationId: string,
    status: OfferAssignmentStatus | 'all'
  ) {
    const values: unknown[] = [organizationId];
    let statusFilter = '';

    if (status !== 'all') {
      values.push(status);
      statusFilter = `AND offer_assignments.status = $${values.length}`;
    }

    const result = await this.database.query<OfferAssignmentWithRelationsRecord>(
      `SELECT offer_assignments.id,
          offer_assignments.organization_id,
          offer_assignments.offer_id,
          offer_assignments.publisher_id,
          offer_assignments.tracking_token,
          offer_assignments.redirect_url,
          offer_assignments.conversion_visibility_percent,
          offer_assignments.postback_percent,
          offer_assignments.status,
          offer_assignments.archived_at,
          offer_assignments.created_at,
          offer_assignments.updated_at,
          offers.name AS offer_name,
          offers.status AS offer_status,
          publishers.name AS publisher_name,
          publishers.status AS publisher_status,
          publishers.publisher_tier,
          publishers.publisher_postback_percent
       FROM offer_assignments
       INNER JOIN offers ON offers.id = offer_assignments.offer_id
       INNER JOIN publishers ON publishers.id = offer_assignments.publisher_id
       WHERE offer_assignments.organization_id = $1
         ${statusFilter}
       ORDER BY offer_assignments.created_at DESC, offer_assignments.id DESC`,
      values
    );

    return result.rows;
  }

  async findAssignment(organizationId: string, assignmentId: string) {
    const result = await this.database.query<OfferAssignmentWithRelationsRecord>(
      `SELECT offer_assignments.id,
          offer_assignments.organization_id,
          offer_assignments.offer_id,
          offer_assignments.publisher_id,
          offer_assignments.tracking_token,
          offer_assignments.redirect_url,
          offer_assignments.conversion_visibility_percent,
          offer_assignments.postback_percent,
          offer_assignments.status,
          offer_assignments.archived_at,
          offer_assignments.created_at,
          offer_assignments.updated_at,
          offers.name AS offer_name,
          offers.status AS offer_status,
          publishers.name AS publisher_name,
          publishers.status AS publisher_status,
          publishers.publisher_tier,
          publishers.publisher_postback_percent
       FROM offer_assignments
       INNER JOIN offers ON offers.id = offer_assignments.offer_id
       INNER JOIN publishers ON publishers.id = offer_assignments.publisher_id
       WHERE offer_assignments.organization_id = $1
         AND offer_assignments.id = $2
       LIMIT 1`,
      [organizationId, assignmentId]
    );

    return result.rows[0] ?? null;
  }

  async findOfferSummary(organizationId: string, offerId: string) {
    const result = await this.database.query<OfferSummaryForAssignmentRecord>(
      `SELECT id, organization_id, advertiser_id, name, status
       FROM offers
       WHERE organization_id = $1
         AND id = $2
       LIMIT 1`,
      [organizationId, offerId]
    );

    return result.rows[0] ?? null;
  }

  async findPublisherSummary(organizationId: string, publisherId: string) {
    const result = await this.database.query<PublisherSummaryForAssignmentRecord>(
      `SELECT id, organization_id, name, status, publisher_tier, publisher_postback_percent
       FROM publishers
       WHERE organization_id = $1
         AND id = $2
       LIMIT 1`,
      [organizationId, publisherId]
    );

    return result.rows[0] ?? null;
  }

  async findNonArchivedDuplicate(organizationId: string, offerId: string, publisherId: string, excludedId: string | null = null) {
    const values: unknown[] = [organizationId, offerId, publisherId];
    let exclusionClause = '';

    if (excludedId) {
      values.push(excludedId);
      exclusionClause = `AND id <> $${values.length}`;
    }

    const result = await this.database.query<OfferAssignmentRecord>(
      `SELECT id, organization_id, offer_id, publisher_id, tracking_token,
          conversion_visibility_percent, postback_percent, status, archived_at, created_at, updated_at
       FROM offer_assignments
       WHERE organization_id = $1
         AND offer_id = $2
         AND publisher_id = $3
         AND status <> 'archived'
         ${exclusionClause}
       LIMIT 1`,
      values
    );

    return result.rows[0] ?? null;
  }

  async updateAssignment(assignment: {
    id: string;
    redirectUrl: string;
    conversionVisibilityPercent: number;
    postbackPercent: number;
  }) {
    const result = await this.database.query<OfferAssignmentRecord>(
      `UPDATE offer_assignments
       SET redirect_url = $2,
           conversion_visibility_percent = $3,
           postback_percent = $4,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, offer_id, publisher_id, tracking_token, redirect_url,
         conversion_visibility_percent, postback_percent, status, archived_at, created_at, updated_at`,
      [assignment.id, assignment.redirectUrl, assignment.conversionVisibilityPercent, assignment.postbackPercent]
    );

    return result.rows[0] ?? null;
  }

  async updateAssignmentStatus(assignmentId: string, status: OfferAssignmentStatus, archivedAt: Date | null) {
    const result = await this.database.query<OfferAssignmentRecord>(
      `UPDATE offer_assignments
       SET status = $2,
           archived_at = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, offer_id, publisher_id, tracking_token, redirect_url,
         conversion_visibility_percent, postback_percent, status, archived_at, created_at, updated_at`,
      [assignmentId, status, archivedAt]
    );

    return result.rows[0] ?? null;
  }

  async listOfferEventDefinitions(offerId: string) {
    const result = await this.database.query<OfferEventDefinitionForAssignmentRecord>(
      `SELECT event_code, event_name, advertiser_payout
       FROM offer_event_definitions
       WHERE offer_id = $1
       ORDER BY created_at ASC, id ASC`,
      [offerId]
    );

    return result.rows;
  }

  async replacePayoutOverrides(
    organizationId: string,
    assignmentId: string,
    overrides: Array<{
      id: string;
      eventCode: string;
      publisherPayoutAmount: string;
    }>
  ) {
    await this.database.query(
      'DELETE FROM offer_assignment_payout_overrides WHERE offer_assignment_id = $1',
      [assignmentId]
    );

    for (const override of overrides) {
      await this.database.query(
        `INSERT INTO offer_assignment_payout_overrides (
           id,
           organization_id,
           offer_assignment_id,
           event_code,
           publisher_payout_amount
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          override.id,
          organizationId,
          assignmentId,
          override.eventCode,
          override.publisherPayoutAmount
        ]
      );
    }
  }

  async listPayoutOverrides(assignmentId: string) {
    const result = await this.database.query<OfferAssignmentPayoutOverrideWithEventRecord>(
      `SELECT overrides.id,
          overrides.offer_assignment_id,
          overrides.event_code,
          overrides.publisher_payout_amount,
          overrides.created_at,
          overrides.updated_at,
          events.event_name
       FROM offer_assignment_payout_overrides AS overrides
       INNER JOIN offer_assignments ON offer_assignments.id = overrides.offer_assignment_id
       INNER JOIN offer_event_definitions AS events
         ON events.offer_id = offer_assignments.offer_id
        AND events.event_code = overrides.event_code
       WHERE overrides.offer_assignment_id = $1
       ORDER BY overrides.created_at ASC, overrides.id ASC`,
      [assignmentId]
    );

    return result.rows;
  }

  async listTierSettings(organizationId: string) {
    const result = await this.database.query<PublisherTierSettingRecord>(
      `SELECT organization_id, tier, payout_percent, created_at, updated_at
       FROM organization_publisher_tier_settings
       WHERE organization_id = $1
       ORDER BY tier ASC`,
      [organizationId]
    );

    return result.rows;
  }

  async findAssignmentByTrackingToken(trackingToken: string) {
    const result = await this.database.query<
      OfferAssignmentWithRelationsRecord & {
        advertiser_id: string;
        advertiser_name: string;
        advertiser_status: 'active' | 'archived';
        organization_name: string;
      }
    >(
      `SELECT offer_assignments.id,
          offer_assignments.organization_id,
          offer_assignments.offer_id,
          offer_assignments.publisher_id,
          offer_assignments.tracking_token,
          offer_assignments.redirect_url,
          offer_assignments.conversion_visibility_percent,
          offer_assignments.postback_percent,
          offer_assignments.status,
          offer_assignments.archived_at,
          offer_assignments.created_at,
          offer_assignments.updated_at,
          offers.name AS offer_name,
          offers.status AS offer_status,
          publishers.name AS publisher_name,
          publishers.status AS publisher_status,
          publishers.publisher_tier,
          publishers.publisher_postback_percent,
          advertisers.id AS advertiser_id,
          advertisers.name AS advertiser_name,
          advertisers.status AS advertiser_status,
          organizations.name AS organization_name
       FROM offer_assignments
       INNER JOIN offers ON offers.id = offer_assignments.offer_id
       INNER JOIN publishers ON publishers.id = offer_assignments.publisher_id
       INNER JOIN advertisers ON advertisers.id = offers.advertiser_id
       INNER JOIN organizations ON organizations.id = offer_assignments.organization_id
       WHERE offer_assignments.tracking_token = $1
       LIMIT 1`,
      [trackingToken]
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
      throw new Error('Nested transactions are not supported in offer assignment repository');
    },
    async close() {}
  };
}
