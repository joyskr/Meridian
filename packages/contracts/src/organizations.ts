export type Organization = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type MembershipRole = 'owner' | 'admin' | 'manager' | 'analyst' | 'viewer';

export type MembershipStatus = 'active' | 'deactivated';

export type OrganizationMembership = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  joined_at: string;
};

export type OrganizationListItem = {
  organization: Organization;
  membership: OrganizationMembership;
  current: boolean;
};

export type CreateOrganizationRequest = {
  name: string;
};

export type CreateOrganizationResponse = {
  organization: Organization;
  membership: OrganizationMembership;
};

export type ListOrganizationsResponse = {
  organizations: OrganizationListItem[];
};

export type CurrentOrganizationResponse = {
  organization: Organization | null;
  membership: OrganizationMembership | null;
};

export type SelectActiveOrganizationRequest = {
  organization_id: string;
};

export type SelectActiveOrganizationResponse = {
  organization: Organization;
  membership: OrganizationMembership;
};
