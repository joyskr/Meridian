import { compare, hash } from 'bcryptjs';
import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import { createOpaqueToken, hashOpaqueToken } from '../../platform/security/token.js';
import type { RuntimeConfig } from '../../platform/config/env.js';
import type { AuthRepository } from './auth-repository.js';
import type { SessionRecord, UserRecord } from './auth-types.js';

export type AuthenticatedActor = {
  user: UserRecord;
  session: SessionRecord;
};

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly config: RuntimeConfig
  ) {}

  async signUp(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await this.repository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError('email_already_in_use', 'conflict', 'Email address is already registered', 409);
    }

    const passwordHash = await hash(password, 12);
    const verificationToken = createOpaqueToken();
    const verificationTokenHash = hashOpaqueToken(verificationToken, this.config.sessionSecret);
    const expiresAt = addHours(new Date(), this.config.emailVerificationTtlHours);

    const user = await this.repository.withTransaction(async (transactionalRepository) => {
      const createdUser = await transactionalRepository.createUser({
        id: createPublicId('usr'),
        email: normalizedEmail,
        password_hash: passwordHash
      });

      await transactionalRepository.consumeChallengesForUser(createdUser.id, 'email_verification');
      await transactionalRepository.createChallenge({
        id: createPublicId('tok'),
        userId: createdUser.id,
        purpose: 'email_verification',
        tokenHash: verificationTokenHash,
        expiresAt
      });

      return createdUser;
    });

    return {
      user: presentUser(user),
      challenge: {
        purpose: 'email_verification' as const,
        expires_at: expiresAt.toISOString()
      },
      rawChallengeToken: verificationToken
    };
  }

  async verifyEmail(token: string) {
    const tokenHash = hashOpaqueToken(token, this.config.sessionSecret);
    const challenge = await this.repository.findActiveChallengeByToken(tokenHash, 'email_verification');

    if (!challenge) {
      throw new AppError('invalid_or_expired_token', 'authentication', 'Verification token is invalid or expired', 401);
    }

    const user = await this.repository.withTransaction(async (transactionalRepository) => {
      await transactionalRepository.consumeChallenge(challenge.id);
      const verifiedUser = await transactionalRepository.markEmailVerified(challenge.user_id);

      if (!verifiedUser) {
        throw new AppError('user_not_found', 'not_found', 'User not found for verification token', 404);
      }

      return verifiedUser;
    });

    return {
      user: presentUser(user)
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.repository.findUserByEmail(normalizedEmail);

    if (!user) {
      throw new AppError('invalid_credentials', 'authentication', 'Invalid email or password', 401);
    }

    const passwordMatches = await compare(password, user.password_hash);

    if (!passwordMatches) {
      throw new AppError('invalid_credentials', 'authentication', 'Invalid email or password', 401);
    }

    if (!user.email_verified_at) {
      throw new AppError('email_not_verified', 'authorization', 'Email address has not been verified', 403);
    }

    const rawSessionToken = createOpaqueToken();
    const sessionTokenHash = hashOpaqueToken(rawSessionToken, this.config.sessionSecret);
    const expiresAt = addHours(new Date(), this.config.sessionTtlHours);
    const session = await this.repository.createSession({
      id: createPublicId('ses'),
      userId: user.id,
      tokenHash: sessionTokenHash,
      expiresAt
    });

    return {
      user: presentUser(user),
      session: presentSession(session, true),
      rawSessionToken
    };
  }

  async getCurrentSession(rawSessionToken: string) {
    const { session, user } = await this.getAuthenticatedActor(rawSessionToken);
    await this.repository.touchSession(session.id);

    return {
      user: presentUser(user),
      session: presentSession(session, true)
    };
  }

  async logout(rawSessionToken: string | null) {
    if (!rawSessionToken) {
      return;
    }

    const tokenHash = hashOpaqueToken(rawSessionToken, this.config.sessionSecret);
    const session = await this.repository.findActiveSessionByToken(tokenHash);

    if (!session) {
      return;
    }

    await this.repository.revokeSession(session.id);
  }

  async getAuthenticatedActor(rawSessionToken: string) {
    const session = await this.getValidatedSession(rawSessionToken);
    const user = await this.repository.findUserById(session.user_id);

    if (!user) {
      throw new AppError('session_user_not_found', 'not_found', 'User for session no longer exists', 404);
    }

    return {
      session,
      user
    } satisfies AuthenticatedActor;
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const user = await this.repository.findUserByEmail(normalizedEmail);

    if (!user || !user.email_verified_at) {
      return {
        accepted: true as const,
        rawChallengeToken: null,
        challenge: null
      };
    }

    const rawChallengeToken = createOpaqueToken();
    const tokenHash = hashOpaqueToken(rawChallengeToken, this.config.sessionSecret);
    const expiresAt = addMinutes(new Date(), this.config.passwordResetTtlMinutes);

    await this.repository.withTransaction(async (transactionalRepository) => {
      await transactionalRepository.consumeChallengesForUser(user.id, 'password_reset');
      await transactionalRepository.createChallenge({
        id: createPublicId('tok'),
        userId: user.id,
        purpose: 'password_reset',
        tokenHash,
        expiresAt
      });
    });

    return {
      accepted: true as const,
      challenge: {
        purpose: 'password_reset' as const,
        expires_at: expiresAt.toISOString()
      },
      rawChallengeToken
    };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = hashOpaqueToken(token, this.config.sessionSecret);
    const challenge = await this.repository.findActiveChallengeByToken(tokenHash, 'password_reset');

    if (!challenge) {
      throw new AppError('invalid_or_expired_token', 'authentication', 'Password reset token is invalid or expired', 401);
    }

    const passwordHash = await hash(password, 12);
    const user = await this.repository.withTransaction(async (transactionalRepository) => {
      await transactionalRepository.consumeChallenge(challenge.id);
      const updatedUser = await transactionalRepository.updatePassword(challenge.user_id, passwordHash);

      if (!updatedUser) {
        throw new AppError('user_not_found', 'not_found', 'User not found for password reset token', 404);
      }

      return updatedUser;
    });

    return {
      user: presentUser(user)
    };
  }

  private async getValidatedSession(rawSessionToken: string) {
    const tokenHash = hashOpaqueToken(rawSessionToken, this.config.sessionSecret);
    const session = await this.repository.findActiveSessionByToken(tokenHash);

    if (!session) {
      throw new AppError('session_not_found', 'authentication', 'Session is missing or expired', 401);
    }

    return session;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function presentUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    email_verified: Boolean(user.email_verified_at),
    created_at: user.created_at.toISOString()
  };
}

function presentSession(session: { id: string; expires_at: Date }, current: boolean) {
  return {
    id: session.id,
    expires_at: session.expires_at.toISOString(),
    current
  };
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
