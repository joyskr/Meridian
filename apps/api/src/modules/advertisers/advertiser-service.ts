import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import type { OrganizationActor } from '../memberships/membership-types.js';
import { AdvertiserRepository } from './advertiser-repository.js';
import type { AdvertiserRecord } from './advertiser-types.js';

export class AdvertiserService {
  constructor(private readonly repository: AdvertiserRepository) {}

  async listAdvertisers(actor: OrganizationActor, status: 'active' | 'archived' | 'all') {
    const advertisers = await this.repository.listAdvertisers(actor.organizationId, status);

    return {
      advertisers: advertisers.map(presentAdvertiser)
    };
  }

  async getAdvertiser(actor: OrganizationActor, advertiserId: string) {
    const advertiser = await this.requireAdvertiser(actor.organizationId, advertiserId);

    return {
      advertiser: presentAdvertiser(advertiser)
    };
  }

  async createAdvertiser(
    actor: OrganizationActor,
    input: {
      name: string;
      websiteUrl: string | null;
      primaryContactName: string | null;
      primaryContactEmail: string | null;
      notes: string | null;
    }
  ) {
    ensureAdvertiserWriteAllowed(actor);

    const name = normalizeName(input.name);
    await this.ensureActiveNameAvailable(actor.organizationId, name);

    const advertiser = await this.repository.createAdvertiser({
      id: createPublicId('adv'),
      organizationId: actor.organizationId,
      name,
      normalizedName: normalizeAdvertiserName(name),
      websiteUrl: normalizeNullable(input.websiteUrl),
      primaryContactName: normalizeNullable(input.primaryContactName),
      primaryContactEmail: normalizeEmail(input.primaryContactEmail),
      notes: normalizeNullable(input.notes)
    });

    return {
      advertiser: presentAdvertiser(advertiser)
    };
  }

  async updateAdvertiser(
    actor: OrganizationActor,
    advertiserId: string,
    input: {
      name?: string;
      websiteUrl?: string | null;
      primaryContactName?: string | null;
      primaryContactEmail?: string | null;
      notes?: string | null;
    }
  ) {
    ensureAdvertiserWriteAllowed(actor);

    const advertiser = await this.requireAdvertiser(actor.organizationId, advertiserId);

    if (advertiser.status === 'archived') {
      throw new AppError(
        'advertiser_archived',
        'business_rule',
        'Archived advertisers must be restored before they can be updated',
        422
      );
    }

    const nextName = input.name !== undefined ? normalizeName(input.name) : advertiser.name;
    await this.ensureActiveNameAvailable(actor.organizationId, nextName, advertiser.id);

    const updatedAdvertiser = await this.repository.updateAdvertiser({
      id: advertiser.id,
      name: nextName,
      normalizedName: normalizeAdvertiserName(nextName),
      websiteUrl: input.websiteUrl !== undefined ? normalizeNullable(input.websiteUrl) : advertiser.website_url,
      primaryContactName:
        input.primaryContactName !== undefined
          ? normalizeNullable(input.primaryContactName)
          : advertiser.primary_contact_name,
      primaryContactEmail:
        input.primaryContactEmail !== undefined
          ? normalizeEmail(input.primaryContactEmail)
          : advertiser.primary_contact_email,
      notes: input.notes !== undefined ? normalizeNullable(input.notes) : advertiser.notes
    });

    if (!updatedAdvertiser) {
      throw new AppError('advertiser_not_found', 'not_found', 'Advertiser not found', 404);
    }

    return {
      advertiser: presentAdvertiser(updatedAdvertiser)
    };
  }

  async archiveAdvertiser(actor: OrganizationActor, advertiserId: string) {
    ensureAdvertiserWriteAllowed(actor);

    const advertiser = await this.requireAdvertiser(actor.organizationId, advertiserId);

    if (advertiser.status === 'archived') {
      return {
        advertiser: presentAdvertiser(advertiser)
      };
    }

    const archivedAdvertiser = await this.repository.updateAdvertiserStatus(
      advertiser.id,
      'archived',
      new Date()
    );

    if (!archivedAdvertiser) {
      throw new AppError('advertiser_not_found', 'not_found', 'Advertiser not found', 404);
    }

    return {
      advertiser: presentAdvertiser(archivedAdvertiser)
    };
  }

  async restoreAdvertiser(actor: OrganizationActor, advertiserId: string) {
    ensureAdvertiserWriteAllowed(actor);

    const advertiser = await this.requireAdvertiser(actor.organizationId, advertiserId);

    if (advertiser.status === 'active') {
      return {
        advertiser: presentAdvertiser(advertiser)
      };
    }

    await this.ensureActiveNameAvailable(actor.organizationId, advertiser.name, advertiser.id);

    const restoredAdvertiser = await this.repository.updateAdvertiserStatus(
      advertiser.id,
      'active',
      null
    );

    if (!restoredAdvertiser) {
      throw new AppError('advertiser_not_found', 'not_found', 'Advertiser not found', 404);
    }

    return {
      advertiser: presentAdvertiser(restoredAdvertiser)
    };
  }

  private async requireAdvertiser(organizationId: string, advertiserId: string) {
    const advertiser = await this.repository.findAdvertiser(organizationId, advertiserId);

    if (!advertiser) {
      throw new AppError('advertiser_not_found', 'not_found', 'Advertiser not found', 404);
    }

    return advertiser;
  }

  private async ensureActiveNameAvailable(
    organizationId: string,
    name: string,
    excludedAdvertiserId: string | null = null
  ) {
    const duplicate = await this.repository.findActiveDuplicateByNormalizedName(
      organizationId,
      normalizeAdvertiserName(name),
      excludedAdvertiserId
    );

    if (duplicate) {
      throw new AppError(
        'advertiser_duplicate_name',
        'conflict',
        'An active advertiser with this name already exists',
        409
      );
    }
  }
}

function ensureAdvertiserWriteAllowed(actor: OrganizationActor) {
  if (actor.membership.role === 'owner' || actor.membership.role === 'admin' || actor.membership.role === 'manager') {
    return;
  }

  throw new AppError(
    'advertiser_write_forbidden',
    'authorization',
    'Current membership cannot modify advertisers',
    403
  );
}

function presentAdvertiser(advertiser: AdvertiserRecord) {
  return {
    id: advertiser.id,
    name: advertiser.name,
    website_url: advertiser.website_url,
    primary_contact_name: advertiser.primary_contact_name,
    primary_contact_email: advertiser.primary_contact_email,
    notes: advertiser.notes,
    status: advertiser.status,
    archived_at: advertiser.archived_at ? advertiser.archived_at.toISOString() : null,
    created_at: advertiser.created_at.toISOString(),
    updated_at: advertiser.updated_at.toISOString()
  };
}

function normalizeName(value: string) {
  return value.trim();
}

function normalizeAdvertiserName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeNullable(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeEmail(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}
