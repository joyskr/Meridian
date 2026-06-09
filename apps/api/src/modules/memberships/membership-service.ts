import { hash } from 'bcryptjs';
import { AppError } from '../../platform/http/shared-error.js';
import type { RuntimeConfig } from '../../platform/config/env.js';
import { createPublicId } from '../../platform/security/ids.js';
import { createOpaqueToken, hashOpaqueToken } from '../../platform/security/token.js';
import type { AuthenticatedActor } from '../auth/auth-service.js';
import type { MembershipRole } from '../organizations/organization-types.js';
import { MembershipRepository } from './membership-repository.js';
import {
  ensureDeactivationAllowed,
  ensureManagerAssignableRole,
  ensureNotSelf,
  ensureProvisionRoleAllowed,
  ensureRoleChangeAllowed,
  ensureTeamAdmin
} from './membership-policy.js';
import type { MembershipWithUserRecord, OrganizationActor } from './membership-types.js';

export class MembershipService {
  constructor(
    private readonly repository: MembershipRepository,
    private readonly config: RuntimeConfig
  ) {}

  async requireOrganizationActor(actor: AuthenticatedActor) {
    const organizationId = actor.session.active_organization_id;

    if (!organizationId) {
      throw new AppError(
        'organization_context_required',
        'business_rule',
        'An active organization must be selected for this request',
        409
      );
    }

    const membership = await this.repository.findActiveMembershipForUser(actor.user.id, organizationId);

    if (!membership) {
      await this.repository.clearActiveOrganizationForSession(actor.session.id);

      throw new AppError(
        'organization_context_required',
        'business_rule',
        'An active organization must be selected for this request',
        409
      );
    }

    return {
      organizationId,
      sessionId: actor.session.id,
      user: {
        id: actor.user.id,
        email: actor.user.email
      },
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status
      }
    } satisfies OrganizationActor;
  }

  async listMemberships(actor: OrganizationActor) {
    ensureTeamAdmin(actor);

    const memberships = await this.repository.listMemberships(actor.organizationId);

    return {
      memberships: memberships.map((membership) => presentMembership(membership, actor.user.id))
    };
  }

  async getMembership(actor: OrganizationActor, membershipId: string) {
    ensureTeamAdmin(actor);

    const membership = await this.requireMembership(actor.organizationId, membershipId);
    return presentMembership(membership, actor.user.id);
  }

  async updateMembershipRole(actor: OrganizationActor, membershipId: string, nextRole: MembershipRole) {
    ensureTeamAdmin(actor);

    const membership = await this.requireMembership(actor.organizationId, membershipId);
    ensureNotSelf(actor, membership.user_id);
    ensureRoleChangeAllowed(actor, membership.membership_role, nextRole);

    if (membership.membership_role === nextRole) {
      return presentMembership(membership, actor.user.id);
    }

    await this.ensureLastOwnerPreserved(actor.organizationId, membership.membership_role, nextRole);

    await this.repository.withTransaction(async (transactionalRepository) => {
      await transactionalRepository.updateMembershipRole(membershipId, nextRole);

      if (nextRole !== 'analyst' && nextRole !== 'viewer') {
        await transactionalRepository.updateMembershipManager(membershipId, null);
      }

      if (membership.membership_role === 'manager' && nextRole !== 'manager') {
        await transactionalRepository.clearManagerAssignmentsForManager(membershipId);
      }
    });

    const updatedMembership = await this.requireMembership(actor.organizationId, membershipId);
    return presentMembership(updatedMembership, actor.user.id);
  }

  async provisionEmployeeAccount(
    actor: OrganizationActor,
    {
      email,
      role,
      managerMembershipId
    }: {
      email: string;
      role: MembershipRole;
      managerMembershipId: string | null;
    }
  ) {
    ensureTeamAdmin(actor);
    ensureProvisionRoleAllowed(actor, role);

    const normalizedEmail = normalizeEmail(email);
    const existingUser = await this.repository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new AppError(
        'email_already_in_use',
        'conflict',
        'Email address is already registered',
        409
      );
    }

    const resolvedManagerMembershipId = await this.resolveManagerMembershipId(
      actor.organizationId,
      role,
      managerMembershipId
    );
    const randomProvisionedPassword = createOpaqueToken();
    const passwordHash = await hash(randomProvisionedPassword, 12);
    const passwordSetupToken = createOpaqueToken();
    const passwordSetupTokenHash = hashOpaqueToken(passwordSetupToken, this.config.sessionSecret);
    const expiresAt = addMinutes(new Date(), this.config.passwordResetTtlMinutes);

    const provisioned = await this.repository.withTransaction(async (transactionalRepository) => {
      const user = await transactionalRepository.createProvisionedUser({
        id: createPublicId('usr'),
        email: normalizedEmail,
        passwordHash
      });

      const membership = await transactionalRepository.createMembership({
        id: createPublicId('mem'),
        organizationId: actor.organizationId,
        userId: user.id,
        role,
        managerMembershipId: resolvedManagerMembershipId
      });

      await transactionalRepository.createPasswordResetChallenge({
        id: createPublicId('tok'),
        userId: user.id,
        tokenHash: passwordSetupTokenHash,
        expiresAt
      });

      return {
        user,
        membershipId: membership.id
      };
    });

    const membership = await this.requireMembership(actor.organizationId, provisioned.membershipId);

    return {
      user: {
        id: provisioned.user.id,
        email: provisioned.user.email,
        email_verified: Boolean(provisioned.user.email_verified_at),
        created_at: provisioned.user.created_at.toISOString()
      },
      membership: presentMembership(membership, actor.user.id).membership,
      password_setup: {
        required: true as const,
        token: passwordSetupToken,
        expires_at: expiresAt.toISOString()
      }
    };
  }

  async assignManager(
    actor: OrganizationActor,
    membershipId: string,
    managerMembershipId: string
  ) {
    ensureTeamAdmin(actor);

    const membership = await this.requireMembership(actor.organizationId, membershipId);
    ensureNotSelf(actor, membership.user_id);
    ensureManagerAssignableRole(membership.membership_role);

    if (membership.membership_status !== 'active') {
      throw new AppError(
        'manager_assignment_inactive_membership',
        'business_rule',
        'Only active memberships may be assigned to a manager',
        422
      );
    }

    if (membership.membership_id === managerMembershipId) {
      throw new AppError(
        'invalid_manager_assignment',
        'business_rule',
        'A membership cannot be assigned to itself as manager',
        422
      );
    }

    const manager = await this.requireManagerMembership(actor.organizationId, managerMembershipId);
    ensureNotSelf(actor, manager.user_id);

    await this.repository.updateMembershipManager(membershipId, managerMembershipId);

    const updatedMembership = await this.requireMembership(actor.organizationId, membershipId);
    return presentMembership(updatedMembership, actor.user.id);
  }

  async removeManager(actor: OrganizationActor, membershipId: string) {
    ensureTeamAdmin(actor);

    const membership = await this.requireMembership(actor.organizationId, membershipId);
    ensureNotSelf(actor, membership.user_id);
    ensureManagerAssignableRole(membership.membership_role);

    await this.repository.updateMembershipManager(membershipId, null);

    const updatedMembership = await this.requireMembership(actor.organizationId, membershipId);
    return presentMembership(updatedMembership, actor.user.id);
  }

  async deactivateMembership(actor: OrganizationActor, membershipId: string) {
    ensureTeamAdmin(actor);

    const membership = await this.requireMembership(actor.organizationId, membershipId);
    ensureNotSelf(actor, membership.user_id);
    ensureDeactivationAllowed(actor, membership.membership_role);

    if (membership.membership_status === 'deactivated') {
      return presentMembership(membership, actor.user.id);
    }

    await this.ensureLastOwnerActive(actor.organizationId, membership.membership_role);

    await this.repository.withTransaction(async (transactionalRepository) => {
      await transactionalRepository.updateMembershipStatus(membershipId, 'deactivated');
      await transactionalRepository.updateMembershipManager(membershipId, null);
      if (membership.membership_role === 'manager') {
        await transactionalRepository.clearManagerAssignmentsForManager(membershipId);
      }
      await transactionalRepository.clearActiveOrganizationForSessions(
        membership.user_id,
        actor.organizationId
      );
    });

    const updatedMembership = await this.requireMembership(actor.organizationId, membershipId);
    return presentMembership(updatedMembership, actor.user.id);
  }

  private async ensureLastOwnerPreserved(
    organizationId: string,
    currentRole: MembershipRole,
    nextRole: MembershipRole
  ) {
    if (currentRole !== 'owner' || nextRole === 'owner') {
      return;
    }

    const ownerCount = await this.repository.countActiveOwners(organizationId);

    if (ownerCount <= 1) {
      throw new AppError(
        'last_owner_protected',
        'business_rule',
        'The last active owner cannot be changed',
        422
      );
    }
  }

  private async ensureLastOwnerActive(organizationId: string, targetRole: MembershipRole) {
    if (targetRole !== 'owner') {
      return;
    }

    const ownerCount = await this.repository.countActiveOwners(organizationId);

    if (ownerCount <= 1) {
      throw new AppError(
        'last_owner_protected',
        'business_rule',
        'The last active owner cannot be changed',
        422
      );
    }
  }

  private async requireMembership(organizationId: string, membershipId: string) {
    const membership = await this.repository.findMembership(organizationId, membershipId);

    if (!membership) {
      throw new AppError('membership_not_found', 'not_found', 'Membership not found', 404);
    }

    return membership;
  }

  private async requireManagerMembership(organizationId: string, managerMembershipId: string) {
    const membership = await this.repository.findManagerMembership(organizationId, managerMembershipId);

    if (!membership) {
      throw new AppError(
        'manager_membership_not_found',
        'not_found',
        'Manager membership not found',
        404
      );
    }

    return membership;
  }

  private async resolveManagerMembershipId(
    organizationId: string,
    role: MembershipRole,
    managerMembershipId: string | null
  ) {
    if (!managerMembershipId) {
      return null;
    }

    ensureManagerAssignableRole(role);
    await this.requireManagerMembership(organizationId, managerMembershipId);
    return managerMembershipId;
  }
}

function presentMembership(membership: MembershipWithUserRecord, currentUserId: string) {
  return {
    membership: {
      id: membership.membership_id,
      role: membership.membership_role,
      status: membership.membership_status,
      joined_at: membership.membership_created_at.toISOString(),
      manager: membership.membership_manager_membership_id
        ? {
            membership_id: membership.membership_manager_membership_id,
            user_id: membership.manager_user_id as string,
            email: membership.manager_user_email as string
          }
        : null
    },
    user: {
      id: membership.user_id,
      email: membership.user_email,
      email_verified: Boolean(membership.user_email_verified_at)
    },
    current: membership.user_id === currentUserId
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}
