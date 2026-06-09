import { AppError } from '../../platform/http/shared-error.js';
import type { MembershipRole } from '../organizations/organization-types.js';
import type { OrganizationActor } from './membership-types.js';

const TEAM_ADMIN_ROLES = new Set<MembershipRole>(['owner', 'admin']);
const OWNER_ADMIN_ROLES = new Set<MembershipRole>(['owner', 'admin']);
const ADMIN_MANAGEABLE_ROLES = new Set<MembershipRole>(['manager', 'analyst', 'viewer']);
const MANAGER_ASSIGNABLE_ROLES = new Set<MembershipRole>(['analyst', 'viewer']);

export function ensureTeamAdmin(actor: OrganizationActor) {
  if (!TEAM_ADMIN_ROLES.has(actor.membership.role)) {
    throw new AppError(
      'insufficient_role',
      'authorization',
      'Current membership cannot manage team access',
      403
    );
  }
}

export function ensureRoleChangeAllowed(
  actor: OrganizationActor,
  targetRole: MembershipRole,
  nextRole: MembershipRole
) {
  if (actor.membership.role === 'owner') {
    return;
  }

  if (!ADMIN_MANAGEABLE_ROLES.has(targetRole) || !ADMIN_MANAGEABLE_ROLES.has(nextRole)) {
    throw new AppError(
      'membership_role_change_forbidden',
      'authorization',
      'Current membership cannot change that role',
      403
    );
  }
}

export function ensureDeactivationAllowed(actor: OrganizationActor, targetRole: MembershipRole) {
  if (actor.membership.role === 'owner') {
    return;
  }

  if (!ADMIN_MANAGEABLE_ROLES.has(targetRole)) {
    throw new AppError(
      'membership_deactivation_forbidden',
      'authorization',
      'Current membership cannot deactivate that member',
      403
    );
  }
}

export function ensureProvisionRoleAllowed(actor: OrganizationActor, role: MembershipRole) {
  if (actor.membership.role === 'owner') {
    return;
  }

  if (!ADMIN_MANAGEABLE_ROLES.has(role)) {
    throw new AppError(
      'membership_provision_forbidden',
      'authorization',
      'Current membership cannot provision that role',
      403
    );
  }
}

export function ensureManagerAssignableRole(role: MembershipRole) {
  if (!MANAGER_ASSIGNABLE_ROLES.has(role)) {
    throw new AppError(
      'manager_assignment_role_invalid',
      'business_rule',
      'Only analyst or viewer memberships can be assigned to a manager',
      422
    );
  }
}

export function ensureNotSelf(actor: OrganizationActor, targetUserId: string | undefined) {
  if (targetUserId && actor.user.id === targetUserId) {
    throw new AppError(
      'self_membership_mutation_forbidden',
      'business_rule',
      'Current membership cannot modify itself through this flow',
      422
    );
  }
}

export function isOwnerOrAdmin(role: MembershipRole) {
  return OWNER_ADMIN_ROLES.has(role);
}
