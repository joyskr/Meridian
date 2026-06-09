import type { MembershipRole, MembershipStatus } from '../organizations/organization-types.js';

export type MembershipWithUserRecord = {
  membership_id: string;
  membership_role: MembershipRole;
  membership_status: MembershipStatus;
  membership_manager_membership_id: string | null;
  membership_created_at: Date;
  user_id: string;
  user_email: string;
  user_email_verified_at: Date | null;
  manager_user_id: string | null;
  manager_user_email: string | null;
};

export type OrganizationActor = {
  organizationId: string;
  sessionId: string;
  user: {
    id: string;
    email: string;
  };
  membership: {
    id: string;
    role: MembershipRole;
    status: MembershipStatus;
  };
};
