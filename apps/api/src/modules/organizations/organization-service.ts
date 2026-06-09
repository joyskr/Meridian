import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import type { AuthenticatedActor } from '../auth/auth-service.js';
import { OrganizationRepository } from './organization-repository.js';

export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}

  async createOrganization(actor: AuthenticatedActor, name: string) {
    const normalizedName = name.trim();

    const organization = await this.repository.withTransaction(async (transactionalRepository) => {
      const createdOrganization = await transactionalRepository.createOrganization({
        id: createPublicId('org'),
        name: normalizedName
      });

      await transactionalRepository.createMembership({
        id: createPublicId('mem'),
        organizationId: createdOrganization.id,
        userId: actor.user.id,
        role: 'owner'
      });

      await transactionalRepository.createDefaultPublisherTierSettings(createdOrganization.id);

      await transactionalRepository.setActiveOrganizationForSession(actor.session.id, createdOrganization.id);

      return createdOrganization;
    });

    const current = await this.repository.findOrganizationForUser(actor.user.id, organization.id);

    if (!current) {
      throw new AppError('organization_membership_not_found', 'system', 'Created organization membership could not be resolved', 500);
    }

    return presentOrganizationSelection(current);
  }

  async listOrganizations(actor: AuthenticatedActor) {
    const organizations = await this.repository.listOrganizationsForUser(actor.user.id);

    return {
      organizations: organizations.map((organization) => ({
        ...presentOrganizationSelection(organization),
        current: organization.organization_id === actor.session.active_organization_id
      }))
    };
  }

  async getCurrentOrganization(actor: AuthenticatedActor) {
    if (!actor.session.active_organization_id) {
      return {
        organization: null,
        membership: null
      };
    }

    const current = await this.repository.findOrganizationForUser(
      actor.user.id,
      actor.session.active_organization_id
    );

    if (!current) {
      await this.repository.setActiveOrganizationForSession(actor.session.id, null);

      return {
        organization: null,
        membership: null
      };
    }

    return presentOrganizationSelection(current);
  }

  async selectActiveOrganization(actor: AuthenticatedActor, organizationId: string) {
    const current = await this.repository.findOrganizationForUser(actor.user.id, organizationId);

    if (!current) {
      throw new AppError(
        'organization_not_accessible',
        'authorization',
        'Organization is not available to the current user',
        403
      );
    }

    await this.repository.setActiveOrganizationForSession(actor.session.id, organizationId);

    return presentOrganizationSelection(current);
  }
}

function presentOrganizationSelection(current: {
  organization_id: string;
  organization_name: string;
  organization_created_at: Date;
  organization_updated_at: Date;
  membership_id: string;
  membership_role: string;
  membership_status: string;
  membership_created_at: Date;
}) {
  return {
    organization: {
      id: current.organization_id,
      name: current.organization_name,
      created_at: current.organization_created_at.toISOString(),
      updated_at: current.organization_updated_at.toISOString()
    },
    membership: {
      id: current.membership_id,
      role: current.membership_role,
      status: current.membership_status,
      joined_at: current.membership_created_at.toISOString()
    }
  };
}
