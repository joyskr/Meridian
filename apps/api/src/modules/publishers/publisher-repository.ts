import type { Database } from '../../platform/database/database.js';
import type {
  PublisherRecord,
  PublisherStatus,
  PublisherTier,
  PublisherTierSettingRecord
} from './publisher-types.js';

export class PublisherRepository {
  constructor(private readonly database: Database) {}

  async createPublisher(publisher: {
    id: string;
    organizationId: string;
    name: string;
    normalizedName: string;
    websiteUrl: string | null;
    primaryContactName: string | null;
    primaryContactEmail: string | null;
    notes: string | null;
    publisherTier: PublisherTier;
    publisherPostbackPercent: number;
  }) {
    const result = await this.database.query<PublisherRecord>(
      `INSERT INTO publishers (
         id,
         organization_id,
         name,
         normalized_name,
         website_url,
         primary_contact_name,
         primary_contact_email,
         notes,
         publisher_tier,
         publisher_postback_percent,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
       RETURNING id, organization_id, name, normalized_name, website_url, primary_contact_name,
         primary_contact_email, notes, publisher_tier, publisher_postback_percent,
         status, archived_at, created_at, updated_at`,
      [
        publisher.id,
        publisher.organizationId,
        publisher.name,
        publisher.normalizedName,
        publisher.websiteUrl,
        publisher.primaryContactName,
        publisher.primaryContactEmail,
        publisher.notes,
        publisher.publisherTier,
        publisher.publisherPostbackPercent
      ]
    );

    return result.rows[0];
  }

  async listPublishers(organizationId: string, status: 'active' | 'archived' | 'all') {
    const values: unknown[] = [organizationId];
    let statusFilter = '';

    if (status !== 'all') {
      values.push(status);
      statusFilter = 'AND status = $2';
    }

    const result = await this.database.query<PublisherRecord>(
      `SELECT id, organization_id, name, normalized_name, website_url, primary_contact_name,
          primary_contact_email, notes, publisher_tier, publisher_postback_percent,
          status, archived_at, created_at, updated_at
       FROM publishers
       WHERE organization_id = $1
         ${statusFilter}
       ORDER BY created_at DESC, id DESC`,
      values
    );

    return result.rows;
  }

  async findPublisher(organizationId: string, publisherId: string) {
    const result = await this.database.query<PublisherRecord>(
      `SELECT id, organization_id, name, normalized_name, website_url, primary_contact_name,
          primary_contact_email, notes, publisher_tier, publisher_postback_percent,
          status, archived_at, created_at, updated_at
       FROM publishers
       WHERE organization_id = $1
         AND id = $2
       LIMIT 1`,
      [organizationId, publisherId]
    );

    return result.rows[0] ?? null;
  }

  async findActiveDuplicateByNormalizedName(
    organizationId: string,
    normalizedName: string,
    excludedPublisherId: string | null = null
  ) {
    const values: unknown[] = [organizationId, normalizedName];
    let exclusionClause = '';

    if (excludedPublisherId) {
      values.push(excludedPublisherId);
      exclusionClause = 'AND id <> $3';
    }

    const result = await this.database.query<PublisherRecord>(
      `SELECT id, organization_id, name, normalized_name, website_url, primary_contact_name,
          primary_contact_email, notes, publisher_tier, publisher_postback_percent,
          status, archived_at, created_at, updated_at
       FROM publishers
       WHERE organization_id = $1
         AND normalized_name = $2
         AND status = 'active'
         ${exclusionClause}
       LIMIT 1`,
      values
    );

    return result.rows[0] ?? null;
  }

  async updatePublisher(publisher: {
    id: string;
    name: string;
    normalizedName: string;
    websiteUrl: string | null;
    primaryContactName: string | null;
    primaryContactEmail: string | null;
    notes: string | null;
    publisherTier: PublisherTier;
    publisherPostbackPercent: number;
  }) {
    const result = await this.database.query<PublisherRecord>(
      `UPDATE publishers
       SET name = $2,
           normalized_name = $3,
           website_url = $4,
           primary_contact_name = $5,
           primary_contact_email = $6,
           notes = $7,
           publisher_tier = $8,
           publisher_postback_percent = $9,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, name, normalized_name, website_url, primary_contact_name,
         primary_contact_email, notes, publisher_tier, publisher_postback_percent,
         status, archived_at, created_at, updated_at`,
      [
        publisher.id,
        publisher.name,
        publisher.normalizedName,
        publisher.websiteUrl,
        publisher.primaryContactName,
        publisher.primaryContactEmail,
        publisher.notes,
        publisher.publisherTier,
        publisher.publisherPostbackPercent
      ]
    );

    return result.rows[0] ?? null;
  }

  async updatePublisherStatus(publisherId: string, status: PublisherStatus, archivedAt: Date | null) {
    const result = await this.database.query<PublisherRecord>(
      `UPDATE publishers
       SET status = $2,
           archived_at = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, name, normalized_name, website_url, primary_contact_name,
         primary_contact_email, notes, publisher_tier, publisher_postback_percent,
         status, archived_at, created_at, updated_at`,
      [publisherId, status, archivedAt]
    );

    return result.rows[0] ?? null;
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

  async replaceTierSettings(
    organizationId: string,
    settings: Record<PublisherTier, number>
  ) {
    await this.database.query(
      `UPDATE organization_publisher_tier_settings
       SET payout_percent = CASE tier
         WHEN 'tier_1' THEN $2
         WHEN 'tier_2' THEN $3
         WHEN 'tier_3' THEN $4
         WHEN 'tier_4' THEN $5
       END,
       updated_at = NOW()
       WHERE organization_id = $1`,
      [organizationId, settings.tier_1, settings.tier_2, settings.tier_3, settings.tier_4]
    );
  }
}
