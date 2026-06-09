import type { MembershipRole, MembershipStatus } from './organizations.js';

export type MembershipUserSummary = {
  id: string;
  email: string;
  email_verified: boolean;
};

export type MembershipManagerSummary = {
  membership_id: string;
  user_id: string;
  email: string;
};

export type OrganizationMembershipSummary = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  joined_at: string;
  manager: MembershipManagerSummary | null;
};

export type MembershipListItem = {
  membership: OrganizationMembershipSummary;
  user: MembershipUserSummary;
  current: boolean;
};

export type ListMembershipsResponse = {
  memberships: MembershipListItem[];
};

export type MembershipDetailResponse = MembershipListItem;

export type UpdateMembershipRoleRequest = {
  role: MembershipRole;
};

export type UpdateMembershipRoleResponse = MembershipListItem;

export type DeactivateMembershipResponse = MembershipListItem;

export type ProvisionMembershipUserRequest = {
  email: string;
  role: MembershipRole;
  manager_membership_id: string | null;
};

export type ProvisionMembershipUserResponse = {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    created_at: string;
  };
  membership: OrganizationMembershipSummary;
  password_setup: {
    required: true;
    token: string;
    expires_at: string;
  };
};

export type AssignMembershipManagerRequest = {
  manager_membership_id: string;
};

export type AssignMembershipManagerResponse = MembershipDetailResponse;

export type RemoveMembershipManagerResponse = MembershipDetailResponse;
