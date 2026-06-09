import type { Database, Queryable } from '../../platform/database/database.js';
import type {
  MembershipRecord,
  MembershipRole,
  OrganizationMembershipRecord,
  OrganizationRecord
} from './organization-types.js';

export class OrganizationRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: OrganizationRepository) => Promise<Result>) {
    return this.database.withTransaction((client) =>
      callback(new OrganizationRepository(transactionalDatabase(client)))
    );
  }

  async createOrganization(organization: { id: string; name: string }) {
    const result = await this.database.query<OrganizationRecord>(
      `INSERT INTO organizations (id, name)
       VALUES ($1, $2)
       RETURNING id, name, created_at, updated_at`,
      [organization.id, organization.name]
    );

    return result.rows[0];
  }

  async createMembership(membership: {
    id: string;
    organizationId: string;
    userId: string;
    role: MembershipRole;
  }) {
    const result = await this.database.query<MembershipRecord>(
      `INSERT INTO memberships (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, organization_id, user_id, role, status, created_at, updated_at`,
      [membership.id, membership.organizationId, membership.userId, membership.role]
    );

    return result.rows[0];
  }

  async createDefaultPublisherTierSettings(organizationId: string) {
    await this.database.query(
      `INSERT INTO organization_publisher_tier_settings (organization_id, tier, payout_percent)
       VALUES
         ($1, 'tier_1', 40),
         ($1, 'tier_2', 55),
         ($1, 'tier_3', 70),
         ($1, 'tier_4', 80)
       ON CONFLICT (organization_id, tier) DO NOTHING`,
      [organizationId]
    );
  }

  async listOrganizationsForUser(userId: string) {
    const result = await this.database.query<OrganizationMembershipRecord>(
      `SELECT
         organizations.id AS organization_id,
         organizations.name AS organization_name,
         organizations.created_at AS organization_created_at,
         organizations.updated_at AS organization_updated_at,
         memberships.id AS membership_id,
         memberships.role AS membership_role,
         memberships.status AS membership_status,
         memberships.created_at AS membership_created_at
       FROM memberships
       INNER JOIN organizations ON organizations.id = memberships.organization_id
       WHERE memberships.user_id = $1
         AND memberships.status = 'active'
       ORDER BY organizations.created_at DESC, organizations.id DESC`,
      [userId]
    );

    return result.rows;
  }

  async findOrganizationForUser(userId: string, organizationId: string) {
    const result = await this.database.query<OrganizationMembershipRecord>(
      `SELECT
         organizations.id AS organization_id,
         organizations.name AS organization_name,
         organizations.created_at AS organization_created_at,
         organizations.updated_at AS organization_updated_at,
         memberships.id AS membership_id,
         memberships.role AS membership_role,
         memberships.status AS membership_status,
         memberships.created_at AS membership_created_at
       FROM memberships
       INNER JOIN organizations ON organizations.id = memberships.organization_id
       WHERE memberships.user_id = $1
         AND memberships.organization_id = $2
         AND memberships.status = 'active'
       LIMIT 1`,
      [userId, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async setActiveOrganizationForSession(sessionId: string, organizationId: string | null) {
    await this.database.query(
      `UPDATE sessions
       SET active_organization_id = $2
       WHERE id = $1`,
      [sessionId, organizationId]
    );
  }
}

function transactionalDatabase(client: Queryable): Database {
  return {
    query(queryText, values) {
      return client.query(queryText, values);
    },
    withTransaction() {
      throw new Error('Nested transactions are not supported in organization repository');
    },
    async close() {}
  };
}
