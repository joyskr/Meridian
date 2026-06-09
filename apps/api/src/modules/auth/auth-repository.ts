import type { Database, Queryable } from '../../platform/database/database.js';
import type {
  AuthChallengePurpose,
  AuthChallengeRecord,
  SessionRecord,
  UserRecord
} from './auth-types.js';

export class AuthRepository {
  constructor(private readonly database: Database) {}

  async withTransaction<Result>(callback: (repository: AuthRepository) => Promise<Result>) {
    return this.database.withTransaction((client) => callback(new AuthRepository(transactionalDatabase(client))));
  }

  async findUserByEmail(email: string) {
    const result = await this.database.query<UserRecord>(
      `SELECT id, email, password_hash, email_verified_at, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    return result.rows[0] ?? null;
  }

  async findUserById(userId: string) {
    const result = await this.database.query<UserRecord>(
      `SELECT id, email, password_hash, email_verified_at, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    return result.rows[0] ?? null;
  }

  async createUser(user: Pick<UserRecord, 'id' | 'email' | 'password_hash'>) {
    const result = await this.database.query<UserRecord>(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, email_verified_at, created_at, updated_at`,
      [user.id, user.email, user.password_hash]
    );

    return result.rows[0];
  }

  async markEmailVerified(userId: string) {
    const result = await this.database.query<UserRecord>(
      `UPDATE users
       SET email_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, password_hash, email_verified_at, created_at, updated_at`,
      [userId]
    );

    return result.rows[0] ?? null;
  }

  async updatePassword(userId: string, passwordHash: string) {
    const result = await this.database.query<UserRecord>(
      `UPDATE users
       SET password_hash = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, password_hash, email_verified_at, created_at, updated_at`,
      [userId, passwordHash]
    );

    return result.rows[0] ?? null;
  }

  async createChallenge(challenge: {
    id: string;
    userId: string;
    purpose: AuthChallengePurpose;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const result = await this.database.query<AuthChallengeRecord>(
      `INSERT INTO auth_challenge_tokens (id, user_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, purpose, token_hash, expires_at, consumed_at, created_at`,
      [challenge.id, challenge.userId, challenge.purpose, challenge.tokenHash, challenge.expiresAt]
    );

    return result.rows[0];
  }

  async findActiveChallengeByToken(tokenHash: string, purpose: AuthChallengePurpose) {
    const result = await this.database.query<AuthChallengeRecord>(
      `SELECT id, user_id, purpose, token_hash, expires_at, consumed_at, created_at
       FROM auth_challenge_tokens
       WHERE token_hash = $1
         AND purpose = $2
         AND consumed_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash, purpose]
    );

    return result.rows[0] ?? null;
  }

  async consumeChallenge(challengeId: string) {
    await this.database.query(
      `UPDATE auth_challenge_tokens
       SET consumed_at = NOW()
       WHERE id = $1`,
      [challengeId]
    );
  }

  async consumeChallengesForUser(userId: string, purpose: AuthChallengePurpose) {
    await this.database.query(
      `UPDATE auth_challenge_tokens
       SET consumed_at = NOW()
       WHERE user_id = $1
         AND purpose = $2
         AND consumed_at IS NULL`,
      [userId, purpose]
    );
  }

  async createSession(session: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const result = await this.database.query<SessionRecord>(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, token_hash, active_organization_id, expires_at, revoked_at, created_at, last_seen_at`,
      [session.id, session.userId, session.tokenHash, session.expiresAt]
    );

    return result.rows[0];
  }

  async findActiveSessionByToken(tokenHash: string) {
    const result = await this.database.query<SessionRecord>(
      `SELECT id, user_id, token_hash, active_organization_id, expires_at, revoked_at, created_at, last_seen_at
       FROM sessions
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash]
    );

    return result.rows[0] ?? null;
  }

  async revokeSession(sessionId: string) {
    await this.database.query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE id = $1
         AND revoked_at IS NULL`,
      [sessionId]
    );
  }

  async touchSession(sessionId: string) {
    await this.database.query(
      `UPDATE sessions
       SET last_seen_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );
  }

  async setActiveOrganization(sessionId: string, organizationId: string | null) {
    await this.database.query(
      `UPDATE sessions
       SET active_organization_id = $2
       WHERE id = $1`,
      [sessionId, organizationId]
    );
  }

  async latestChallengeForUser(userId: string, purpose: AuthChallengePurpose) {
    const result = await this.database.query<AuthChallengeRecord>(
      `SELECT id, user_id, purpose, token_hash, expires_at, consumed_at, created_at
       FROM auth_challenge_tokens
       WHERE user_id = $1
         AND purpose = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, purpose]
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
      throw new Error('Nested transactions are not supported in auth repository');
    },
    async close() {}
  };
}
