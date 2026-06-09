export type MembershipRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'viewer';

export type MembershipStatus = 'active' | 'deactivated';

export type OrganizationRecord = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
};

export type MembershipRecord = {
  id: string;
  organization_id: string;
  user_id: string;
  role: MembershipRole;
  status: MembershipStatus;
  manager_membership_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OrganizationMembershipRecord = {
  organization_id: string;
  organization_name: string;
  organization_created_at: Date;
  organization_updated_at: Date;
  membership_id: string;
  membership_role: MembershipRole;
  membership_status: MembershipStatus;
  membership_created_at: Date;
};
