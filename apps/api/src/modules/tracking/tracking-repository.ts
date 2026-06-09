import type { Database, Queryable } from '../../platform/database/database.js';
import type {
  ApprovedAttributionParameters,
  ClickRecord,
  ClickWithRelationsRecord,
  TrackingAssignmentResolutionRecord
} from './tracking-types.js';

export class TrackingRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: TrackingRepository) => Promise<Result>) {
    return this.database.withTransaction((client) =>
      callback(new TrackingRepository(transactionalDatabase(client)))
    );
  }

  async findTrackingAssignmentByToken(trackingToken: string) {
    const result = await this.database.query<TrackingAssignmentResolutionRecord>(
      `SELECT offer_assignments.id AS assignment_id,
          offer_assignments.organization_id,
          organizations.name AS organization_name,
          offer_assignments.offer_id,
          offers.name AS offer_name,
          offers.status AS offer_status,
          offer_assignments.publisher_id,
          publishers.name AS publisher_name,
          publishers.status AS publisher_status,
          advertisers.id AS advertiser_id,
          advertisers.name AS advertiser_name,
          advertisers.status AS advertiser_status,
          offer_assignments.status AS assignment_status,
          offer_assignments.redirect_url
       FROM offer_assignments
       INNER JOIN organizations ON organizations.id = offer_assignments.organization_id
       INNER JOIN offers ON offers.id = offer_assignments.offer_id
       INNER JOIN publishers ON publishers.id = offer_assignments.publisher_id
       INNER JOIN advertisers ON advertisers.id = offers.advertiser_id
       WHERE offer_assignments.tracking_token = $1
       LIMIT 1`,
      [trackingToken]
    );

    return result.rows[0] ?? null;
  }

  async createClick(click: {
    id: string;
    organizationId: string;
    assignmentId: string;
    offerId: string;
    publisherId: string;
    advertiserId: string;
    trackingTokenHash: string;
    trackingResolutionStatus: 'accepted';
    resolvedRedirectUrl: string;
    requestIpHash: string | null;
    attribution: ApprovedAttributionParameters;
    requestUserAgent: string | null;
    requestReferer: string | null;
    requestId: string | null;
    clickedAt: Date;
  }) {
    const result = await this.database.query<ClickRecord>(
      `INSERT INTO clicks (
         id,
         organization_id,
         offer_assignment_id,
         offer_id,
         publisher_id,
         advertiser_id,
         tracking_token_hash,
         tracking_resolution_status,
         resolved_redirect_url,
         request_ip_hash,
         attribution_sub1,
         attribution_sub2,
         attribution_sub3,
         attribution_sub4,
         attribution_sub5,
         attribution_utm_source,
         attribution_utm_medium,
         attribution_utm_campaign,
         attribution_utm_content,
         attribution_utm_term,
         request_user_agent,
         request_referer,
         request_id,
         clicked_at
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         CAST($10 AS TEXT),
         CAST($11 AS TEXT),
         CAST($12 AS TEXT),
         CAST($13 AS TEXT),
         CAST($14 AS TEXT),
         CAST($15 AS TEXT),
         CAST($16 AS TEXT),
         CAST($17 AS TEXT),
         CAST($18 AS TEXT),
         CAST($19 AS TEXT),
         CAST($20 AS TEXT),
         CAST($21 AS TEXT),
         CAST($22 AS TEXT),
         CAST($23 AS TEXT),
         CAST($24 AS TIMESTAMPTZ)
       )
       RETURNING id, organization_id, offer_assignment_id, offer_id, publisher_id, advertiser_id,
         tracking_token_hash, tracking_resolution_status, resolved_redirect_url, request_ip_hash,
         attribution_sub1, attribution_sub2, attribution_sub3, attribution_sub4, attribution_sub5,
         attribution_utm_source, attribution_utm_medium, attribution_utm_campaign,
         attribution_utm_content, attribution_utm_term, request_user_agent, request_referer,
         request_id, clicked_at, created_at`,
      [
        click.id,
        click.organizationId,
        click.assignmentId,
        click.offerId,
        click.publisherId,
        click.advertiserId,
        click.trackingTokenHash,
        click.trackingResolutionStatus,
        click.resolvedRedirectUrl,
        click.requestIpHash,
        click.attribution.sub1,
        click.attribution.sub2,
        click.attribution.sub3,
        click.attribution.sub4,
        click.attribution.sub5,
        click.attribution.utm_source,
        click.attribution.utm_medium,
        click.attribution.utm_campaign,
        click.attribution.utm_content,
        click.attribution.utm_term,
        click.requestUserAgent,
        click.requestReferer,
        click.requestId,
        click.clickedAt
      ]
    );

    return result.rows[0];
  }

  async listClicks(
    organizationId: string,
    filters: {
      assignmentId?: string;
      offerId?: string;
      publisherId?: string;
      advertiserId?: string;
    }
  ) {
    const values: unknown[] = [organizationId];
    const whereClauses = ['clicks.organization_id = $1'];

    if (filters.assignmentId) {
      values.push(filters.assignmentId);
      whereClauses.push(`clicks.offer_assignment_id = $${values.length}`);
    }

    if (filters.offerId) {
      values.push(filters.offerId);
      whereClauses.push(`clicks.offer_id = $${values.length}`);
    }

    if (filters.publisherId) {
      values.push(filters.publisherId);
      whereClauses.push(`clicks.publisher_id = $${values.length}`);
    }

    if (filters.advertiserId) {
      values.push(filters.advertiserId);
      whereClauses.push(`clicks.advertiser_id = $${values.length}`);
    }

    const result = await this.database.query<ClickWithRelationsRecord>(
      `SELECT clicks.id,
          clicks.organization_id,
          clicks.offer_assignment_id,
          clicks.offer_id,
          clicks.publisher_id,
          clicks.advertiser_id,
          clicks.tracking_token_hash,
          clicks.tracking_resolution_status,
          clicks.resolved_redirect_url,
          clicks.request_ip_hash,
          clicks.attribution_sub1,
          clicks.attribution_sub2,
          clicks.attribution_sub3,
          clicks.attribution_sub4,
          clicks.attribution_sub5,
          clicks.attribution_utm_source,
          clicks.attribution_utm_medium,
          clicks.attribution_utm_campaign,
          clicks.attribution_utm_content,
          clicks.attribution_utm_term,
          clicks.request_user_agent,
          clicks.request_referer,
          clicks.request_id,
          clicks.clicked_at,
          clicks.created_at,
          organizations.name AS organization_name,
          offers.name AS offer_name,
          publishers.name AS publisher_name,
          advertisers.name AS advertiser_name
       FROM clicks
       INNER JOIN organizations ON organizations.id = clicks.organization_id
       INNER JOIN offers ON offers.id = clicks.offer_id
       INNER JOIN publishers ON publishers.id = clicks.publisher_id
       INNER JOIN advertisers ON advertisers.id = clicks.advertiser_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY clicks.clicked_at DESC, clicks.id DESC`,
      values
    );

    return result.rows;
  }

  async findClick(organizationId: string, clickId: string) {
    const result = await this.database.query<ClickWithRelationsRecord>(
      `SELECT clicks.id,
          clicks.organization_id,
          clicks.offer_assignment_id,
          clicks.offer_id,
          clicks.publisher_id,
          clicks.advertiser_id,
          clicks.tracking_token_hash,
          clicks.tracking_resolution_status,
          clicks.resolved_redirect_url,
          clicks.request_ip_hash,
          clicks.attribution_sub1,
          clicks.attribution_sub2,
          clicks.attribution_sub3,
          clicks.attribution_sub4,
          clicks.attribution_sub5,
          clicks.attribution_utm_source,
          clicks.attribution_utm_medium,
          clicks.attribution_utm_campaign,
          clicks.attribution_utm_content,
          clicks.attribution_utm_term,
          clicks.request_user_agent,
          clicks.request_referer,
          clicks.request_id,
          clicks.clicked_at,
          clicks.created_at,
          organizations.name AS organization_name,
          offers.name AS offer_name,
          publishers.name AS publisher_name,
          advertisers.name AS advertiser_name
       FROM clicks
       INNER JOIN organizations ON organizations.id = clicks.organization_id
       INNER JOIN offers ON offers.id = clicks.offer_id
       INNER JOIN publishers ON publishers.id = clicks.publisher_id
       INNER JOIN advertisers ON advertisers.id = clicks.advertiser_id
       WHERE clicks.organization_id = $1
         AND clicks.id = $2
       LIMIT 1`,
      [organizationId, clickId]
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
      throw new Error('Nested transactions are not supported in tracking repository');
    },
    async close() {}
  };
}
