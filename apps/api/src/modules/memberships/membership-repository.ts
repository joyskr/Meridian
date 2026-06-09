import type { Database, Queryable } from '../../platform/database/database.js';
import type { AuthChallengeRecord, UserRecord } from '../auth/auth-types.js';
import type { MembershipRecord } from '../organizations/organization-types.js';
import type { MembershipWithUserRecord } from './membership-types.js';

export class MembershipRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: MembershipRepository) => Promise<Result>) {
    return this.database.withTransaction((client) =>
      callback(new MembershipRepository(transactionalDatabase(client)))
    );
  }

  async findActiveMembershipForUser(userId: string, organizationId: string) {
    const result = await this.database.query<MembershipRecord>(
      `SELECT id, organization_id, user_id, role, status, manager_membership_id, created_at, updated_at
       FROM memberships
       WHERE user_id = $1
         AND organization_id = $2
         AND status = 'active'
       LIMIT 1`,
      [userId, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async findMembershipForEmail(organizationId: string, email: string) {
    const result = await this.database.query<MembershipWithUserRecord>(
      `SELECT
         memberships.id AS membership_id,
         memberships.role AS membership_role,
         memberships.status AS membership_status,
         memberships.manager_membership_id AS membership_manager_membership_id,
         memberships.created_at AS membership_created_at,
         users.id AS user_id,
         users.email AS user_email,
         users.email_verified_at AS user_email_verified_at,
         manager_users.id AS manager_user_id,
         manager_users.email AS manager_user_email
       FROM memberships
       INNER JOIN users ON users.id = memberships.user_id
       LEFT JOIN memberships AS manager_memberships
         ON manager_memberships.id = memberships.manager_membership_id
       LEFT JOIN users AS manager_users
         ON manager_users.id = manager_memberships.user_id
       WHERE memberships.organization_id = $1
         AND users.email = $2
       LIMIT 1`,
      [organizationId, email]
    );

    return result.rows[0] ?? null;
  }

  async listMemberships(organizationId: string) {
    const result = await this.database.query<MembershipWithUserRecord>(
      `SELECT
         memberships.id AS membership_id,
         memberships.role AS membership_role,
         memberships.status AS membership_status,
         memberships.manager_membership_id AS membership_manager_membership_id,
         memberships.created_at AS membership_created_at,
         users.id AS user_id,
         users.email AS user_email,
         users.email_verified_at AS user_email_verified_at,
         manager_users.id AS manager_user_id,
         manager_users.email AS manager_user_email
       FROM memberships
       INNER JOIN users ON users.id = memberships.user_id
       LEFT JOIN memberships AS manager_memberships
         ON manager_memberships.id = memberships.manager_membership_id
       LEFT JOIN users AS manager_users
         ON manager_users.id = manager_memberships.user_id
       WHERE memberships.organization_id = $1
       ORDER BY memberships.created_at ASC, memberships.id ASC`,
      [organizationId]
    );

    return result.rows;
  }

  async findMembership(organizationId: string, membershipId: string) {
    const result = await this.database.query<MembershipWithUserRecord>(
      `SELECT
         memberships.id AS membership_id,
         memberships.role AS membership_role,
         memberships.status AS membership_status,
         memberships.manager_membership_id AS membership_manager_membership_id,
         memberships.created_at AS membership_created_at,
         users.id AS user_id,
         users.email AS user_email,
         users.email_verified_at AS user_email_verified_at,
         manager_users.id AS manager_user_id,
         manager_users.email AS manager_user_email
       FROM memberships
       INNER JOIN users ON users.id = memberships.user_id
       LEFT JOIN memberships AS manager_memberships
         ON manager_memberships.id = memberships.manager_membership_id
       LEFT JOIN users AS manager_users
         ON manager_users.id = manager_memberships.user_id
       WHERE memberships.organization_id = $1
         AND memberships.id = $2
       LIMIT 1`,
      [organizationId, membershipId]
    );

    return result.rows[0] ?? null;
  }

  async findManagerMembership(organizationId: string, membershipId: string) {
    const result = await this.database.query<MembershipWithUserRecord>(
      `SELECT
         memberships.id AS membership_id,
         memberships.role AS membership_role,
         memberships.status AS membership_status,
         memberships.manager_membership_id AS membership_manager_membership_id,
         memberships.created_at AS membership_created_at,
         users.id AS user_id,
         users.email AS user_email,
         users.email_verified_at AS user_email_verified_at,
         NULL::text AS manager_user_id,
         NULL::text AS manager_user_email
       FROM memberships
       INNER JOIN users ON users.id = memberships.user_id
       WHERE memberships.organization_id = $1
         AND memberships.id = $2
         AND memberships.role = 'manager'
         AND memberships.status = 'active'
       LIMIT 1`,
      [organizationId, membershipId]
    );

    return result.rows[0] ?? null;
  }

  async findUserByEmail(email: string) {
    const result = await this.database.query<UserRecord>(
      `SELECT id, email, password_hash, email_verified_at, created_at, updated_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    return result.rows[0] ?? null;
  }

  async createProvisionedUser(user: {
    id: string;
    email: string;
    passwordHash: string;
  }) {
    const result = await this.database.query<UserRecord>(
      `INSERT INTO users (id, email, password_hash, email_verified_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, email, password_hash, email_verified_at, created_at, updated_at`,
      [user.id, user.email, user.passwordHash]
    );

    return result.rows[0];
  }

  async createPasswordResetChallenge(challenge: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const result = await this.database.query<AuthChallengeRecord>(
      `INSERT INTO auth_challenge_tokens (id, user_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, 'password_reset', $3, $4)
       RETURNING id, user_id, purpose, token_hash, expires_at, consumed_at, created_at`,
      [challenge.id, challenge.userId, challenge.tokenHash, challenge.expiresAt]
    );

    return result.rows[0];
  }

  async createMembership(membership: {
    id: string;
    organizationId: string;
    userId: string;
    role: MembershipRecord['role'];
    managerMembershipId: string | null;
  }) {
    const result = await this.database.query<MembershipRecord>(
      `INSERT INTO memberships (id, organization_id, user_id, role, status, manager_membership_id)
       VALUES ($1, $2, $3, $4, 'active', $5)
       RETURNING id, organization_id, user_id, role, status, manager_membership_id, created_at, updated_at`,
      [
        membership.id,
        membership.organizationId,
        membership.userId,
        membership.role,
        membership.managerMembershipId
      ]
    );

    return result.rows[0];
  }

  async updateMembershipRole(membershipId: string, role: MembershipRecord['role']) {
    const result = await this.database.query<MembershipRecord>(
      `UPDATE memberships
       SET role = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, user_id, role, status, manager_membership_id, created_at, updated_at`,
      [membershipId, role]
    );

    return result.rows[0] ?? null;
  }

  async updateMembershipStatus(membershipId: string, status: MembershipRecord['status']) {
    const result = await this.database.query<MembershipRecord>(
      `UPDATE memberships
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, user_id, role, status, manager_membership_id, created_at, updated_at`,
      [membershipId, status]
    );

    return result.rows[0] ?? null;
  }

  async updateMembershipManager(membershipId: string, managerMembershipId: string | null) {
    const result = await this.database.query<MembershipRecord>(
      `UPDATE memberships
       SET manager_membership_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, user_id, role, status, manager_membership_id, created_at, updated_at`,
      [membershipId, managerMembershipId]
    );

    return result.rows[0] ?? null;
  }

  async clearManagerAssignmentsForManager(managerMembershipId: string) {
    await this.database.query(
      `UPDATE memberships
       SET manager_membership_id = NULL, updated_at = NOW()
       WHERE manager_membership_id = $1`,
      [managerMembershipId]
    );
  }

  async countActiveOwners(organizationId: string) {
    const result = await this.database.query<{ owner_count: string }>(
      `SELECT COUNT(*)::text AS owner_count
       FROM memberships
       WHERE organization_id = $1
         AND role = 'owner'
         AND status = 'active'`,
      [organizationId]
    );

    return Number(result.rows[0]?.owner_count ?? 0);
  }

  async clearActiveOrganizationForSessions(userId: string, organizationId: string) {
    await this.database.query(
      `UPDATE sessions
       SET active_organization_id = NULL
       WHERE user_id = $1
         AND active_organization_id = $2`,
      [userId, organizationId]
    );
  }

  async clearActiveOrganizationForSession(sessionId: string) {
    await this.database.query(
      `UPDATE sessions
       SET active_organization_id = NULL
       WHERE id = $1`,
      [sessionId]
    );
  }
}

function transactionalDatabase(client: Queryable): Database {
  return {
    query(queryText, values) {
      return client.query(queryText, values);
    },
    withTransaction() {
      throw new Error('Nested transactions are not supported in membership repository');
    },
    async close() {}
  };
}
