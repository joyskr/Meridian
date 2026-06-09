import type { Database } from '../../platform/database/database.js';
import type { AdvertiserRecord, AdvertiserStatus } from './advertiser-types.js';

export class AdvertiserRepository {
  constructor(private readonly database: Database) {}

  async createAdvertiser(advertiser: {
    id: string;
    organizationId: string;
    name: string;
    normalizedName: string;
    websiteUrl: string | null;
    primaryContactName: string | null;
    primaryContactEmail: string | null;
    notes: string | null;
  }) {
    const result = await this.database.query<AdvertiserRecord>(
      `INSERT INTO advertisers (
         id,
         organization_id,
         name,
         normalized_name,
         website_url,
         primary_contact_name,
         primary_contact_email,
         notes,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id, organization_id, name, normalized_name, website_url, primary_contact_name,
         primary_contact_email, notes, status, archived_at, created_at, updated_at`,
      [
        advertiser.id,
        advertiser.organizationId,
        advertiser.name,
        advertiser.normalizedName,
        advertiser.websiteUrl,
        advertiser.primaryContactName,
        advertiser.primaryContactEmail,
        advertiser.notes
      ]
    );

    return result.rows[0];
  }

  async listAdvertisers(organizationId: string, status: 'active' | 'archived' | 'all') {
    const values: unknown[] = [organizationId];
    let statusFilter = '';

    if (status !== 'all') {
      values.push(status);
      statusFilter = 'AND status = $2';
    }

    const result = await this.database.query<AdvertiserRecord>(
      `SELECT id, organization_id, name, normalized_name, website_url, primary_contact_name,
          primary_contact_email, notes, status, archived_at, created_at, updated_at
       FROM advertisers
       WHERE organization_id = $1
         ${statusFilter}
       ORDER BY created_at DESC, id DESC`,
      values
    );

    return result.rows;
  }

  async findAdvertiser(organizationId: string, advertiserId: string) {
    const result = await this.database.query<AdvertiserRecord>(
      `SELECT id, organization_id, name, normalized_name, website_url, primary_contact_name,
          primary_contact_email, notes, status, archived_at, created_at, updated_at
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
    normalizedName: string,
    excludedAdvertiserId: string | null = null
  ) {
    const values: unknown[] = [organizationId, normalizedName];
    let exclusionClause = '';

    if (excludedAdvertiserId) {
      values.push(excludedAdvertiserId);
      exclusionClause = 'AND id <> $3';
    }

    const result = await this.database.query<AdvertiserRecord>(
      `SELECT id, organization_id, name, normalized_name, website_url, primary_contact_name,
          primary_contact_email, notes, status, archived_at, created_at, updated_at
       FROM advertisers
       WHERE organization_id = $1
         AND normalized_name = $2
         AND status = 'active'
         ${exclusionClause}
       LIMIT 1`,
      values
    );

    return result.rows[0] ?? null;
  }

  async updateAdvertiser(advertiser: {
    id: string;
    name: string;
    normalizedName: string;
    websiteUrl: string | null;
    primaryContactName: string | null;
    primaryContactEmail: string | null;
    notes: string | null;
  }) {
    const result = await this.database.query<AdvertiserRecord>(
      `UPDATE advertisers
       SET name = $2,
           normalized_name = $3,
           website_url = $4,
           primary_contact_name = $5,
           primary_contact_email = $6,
           notes = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, name, normalized_name, website_url, primary_contact_name,
         primary_contact_email, notes, status, archived_at, created_at, updated_at`,
      [
        advertiser.id,
        advertiser.name,
        advertiser.normalizedName,
        advertiser.websiteUrl,
        advertiser.primaryContactName,
        advertiser.primaryContactEmail,
        advertiser.notes
      ]
    );

    return result.rows[0] ?? null;
  }

  async updateAdvertiserStatus(advertiserId: string, status: AdvertiserStatus, archivedAt: Date | null) {
    const result = await this.database.query<AdvertiserRecord>(
      `UPDATE advertisers
       SET status = $2,
           archived_at = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, name, normalized_name, website_url, primary_contact_name,
         primary_contact_email, notes, status, archived_at, created_at, updated_at`,
      [advertiserId, status, archivedAt]
    );

    return result.rows[0] ?? null;
  }
}
