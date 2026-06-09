import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import type { OrganizationActor } from '../memberships/membership-types.js';
import { PublisherRepository } from './publisher-repository.js';
import type { PublisherRecord, PublisherTier } from './publisher-types.js';

export class PublisherService {
  constructor(private readonly repository: PublisherRepository) {}

  async listPublishers(actor: OrganizationActor, status: 'active' | 'archived' | 'all') {
    const publishers = await this.repository.listPublishers(actor.organizationId, status);

    return {
      publishers: publishers.map(presentPublisher)
    };
  }

  async getPublisher(actor: OrganizationActor, publisherId: string) {
    const publisher = await this.requirePublisher(actor.organizationId, publisherId);

    return {
      publisher: presentPublisher(publisher)
    };
  }

  async createPublisher(
    actor: OrganizationActor,
    input: {
      name: string;
      websiteUrl: string | null;
      primaryContactName: string | null;
      primaryContactEmail: string | null;
      notes: string | null;
      publisherTier: PublisherTier | null;
      publisherPostbackPercent: number | null;
    }
  ) {
    ensurePublisherWriteAllowed(actor);
    ensurePublisherControlEditAllowed(actor, input.publisherTier, input.publisherPostbackPercent);

    const name = normalizeName(input.name);
    await this.ensureActiveNameAvailable(actor.organizationId, name);

    const publisher = await this.repository.createPublisher({
      id: createPublicId('pub'),
      organizationId: actor.organizationId,
      name,
      normalizedName: normalizePublisherName(name),
      websiteUrl: normalizeNullable(input.websiteUrl),
      primaryContactName: normalizeNullable(input.primaryContactName),
      primaryContactEmail: normalizeEmail(input.primaryContactEmail),
      notes: normalizeNullable(input.notes),
      publisherTier: input.publisherTier ?? 'tier_1',
      publisherPostbackPercent: input.publisherPostbackPercent ?? 100
    });

    return {
      publisher: presentPublisher(publisher)
    };
  }

  async updatePublisher(
    actor: OrganizationActor,
    publisherId: string,
    input: {
      name?: string;
      websiteUrl?: string | null;
      primaryContactName?: string | null;
      primaryContactEmail?: string | null;
      notes?: string | null;
      publisherTier?: PublisherTier | null;
      publisherPostbackPercent?: number | null;
    }
  ) {
    ensurePublisherWriteAllowed(actor);
    ensurePublisherControlEditAllowed(actor, input.publisherTier, input.publisherPostbackPercent);

    const publisher = await this.requirePublisher(actor.organizationId, publisherId);

    if (publisher.status === 'archived') {
      throw new AppError(
        'publisher_archived',
        'business_rule',
        'Archived publishers must be restored before they can be updated',
        422
      );
    }

    const nextName = input.name !== undefined ? normalizeName(input.name) : publisher.name;
    await this.ensureActiveNameAvailable(actor.organizationId, nextName, publisher.id);

    const updatedPublisher = await this.repository.updatePublisher({
      id: publisher.id,
      name: nextName,
      normalizedName: normalizePublisherName(nextName),
      websiteUrl: input.websiteUrl !== undefined ? normalizeNullable(input.websiteUrl) : publisher.website_url,
      primaryContactName:
        input.primaryContactName !== undefined
          ? normalizeNullable(input.primaryContactName)
          : publisher.primary_contact_name,
      primaryContactEmail:
        input.primaryContactEmail !== undefined
          ? normalizeEmail(input.primaryContactEmail)
          : publisher.primary_contact_email,
      notes: input.notes !== undefined ? normalizeNullable(input.notes) : publisher.notes,
      publisherTier:
        input.publisherTier !== undefined && input.publisherTier !== null
          ? input.publisherTier
          : publisher.publisher_tier,
      publisherPostbackPercent:
        input.publisherPostbackPercent !== undefined && input.publisherPostbackPercent !== null
          ? input.publisherPostbackPercent
          : publisher.publisher_postback_percent
    });

    if (!updatedPublisher) {
      throw new AppError('publisher_not_found', 'not_found', 'Publisher not found', 404);
    }

    return {
      publisher: presentPublisher(updatedPublisher)
    };
  }

  async archivePublisher(actor: OrganizationActor, publisherId: string) {
    ensurePublisherWriteAllowed(actor);

    const publisher = await this.requirePublisher(actor.organizationId, publisherId);

    if (publisher.status === 'archived') {
      return {
        publisher: presentPublisher(publisher)
      };
    }

    const archivedPublisher = await this.repository.updatePublisherStatus(
      publisher.id,
      'archived',
      new Date()
    );

    if (!archivedPublisher) {
      throw new AppError('publisher_not_found', 'not_found', 'Publisher not found', 404);
    }

    return {
      publisher: presentPublisher(archivedPublisher)
    };
  }

  async restorePublisher(actor: OrganizationActor, publisherId: string) {
    ensurePublisherWriteAllowed(actor);

    const publisher = await this.requirePublisher(actor.organizationId, publisherId);

    if (publisher.status === 'active') {
      return {
        publisher: presentPublisher(publisher)
      };
    }

    await this.ensureActiveNameAvailable(actor.organizationId, publisher.name, publisher.id);

    const restoredPublisher = await this.repository.updatePublisherStatus(
      publisher.id,
      'active',
      null
    );

    if (!restoredPublisher) {
      throw new AppError('publisher_not_found', 'not_found', 'Publisher not found', 404);
    }

    return {
      publisher: presentPublisher(restoredPublisher)
    };
  }

  async getTierSettings(actor: OrganizationActor) {
    ensurePublisherControlAdmin(actor);

    const settings = await this.repository.listTierSettings(actor.organizationId);
    return {
      tier_settings: presentTierSettings(settings)
    };
  }

  async updateTierSettings(
    actor: OrganizationActor,
    settings: Record<PublisherTier, number>
  ) {
    ensurePublisherControlAdmin(actor);

    await this.repository.replaceTierSettings(actor.organizationId, settings);
    return this.getTierSettings(actor);
  }

  private async requirePublisher(organizationId: string, publisherId: string) {
    const publisher = await this.repository.findPublisher(organizationId, publisherId);

    if (!publisher) {
      throw new AppError('publisher_not_found', 'not_found', 'Publisher not found', 404);
    }

    return publisher;
  }

  private async ensureActiveNameAvailable(
    organizationId: string,
    name: string,
    excludedPublisherId: string | null = null
  ) {
    const duplicate = await this.repository.findActiveDuplicateByNormalizedName(
      organizationId,
      normalizePublisherName(name),
      excludedPublisherId
    );

    if (duplicate) {
      throw new AppError(
        'publisher_duplicate_name',
        'conflict',
        'An active publisher with this name already exists',
        409
      );
    }
  }
}

function ensurePublisherWriteAllowed(actor: OrganizationActor) {
  if (actor.membership.role === 'owner' || actor.membership.role === 'admin' || actor.membership.role === 'manager') {
    return;
  }

  throw new AppError(
    'publisher_write_forbidden',
    'authorization',
    'Current membership cannot modify publishers',
    403
  );
}

function ensurePublisherControlAdmin(actor: OrganizationActor) {
  if (actor.membership.role === 'owner' || actor.membership.role === 'admin') {
    return;
  }

  throw new AppError(
    'publisher_controls_forbidden',
    'authorization',
    'Current membership cannot modify publisher payout controls',
    403
  );
}

function ensurePublisherControlEditAllowed(
  actor: OrganizationActor,
  publisherTier: PublisherTier | null | undefined,
  publisherPostbackPercent: number | null | undefined
) {
  if (publisherTier == null && publisherPostbackPercent == null) {
    return;
  }

  ensurePublisherControlAdmin(actor);
}

function presentPublisher(publisher: PublisherRecord) {
  return {
    id: publisher.id,
    name: publisher.name,
    website_url: publisher.website_url,
    primary_contact_name: publisher.primary_contact_name,
    primary_contact_email: publisher.primary_contact_email,
    notes: publisher.notes,
    publisher_tier: publisher.publisher_tier,
    publisher_postback_percent: publisher.publisher_postback_percent,
    status: publisher.status,
    archived_at: publisher.archived_at ? publisher.archived_at.toISOString() : null,
    created_at: publisher.created_at.toISOString(),
    updated_at: publisher.updated_at.toISOString()
  };
}

function presentTierSettings(settings: Array<{ tier: PublisherTier; payout_percent: number; updated_at: Date }>) {
  const tierSettings = {
    tier_1: 0,
    tier_2: 0,
    tier_3: 0,
    tier_4: 0,
    updated_at: null as string | null
  };

  for (const setting of settings) {
    tierSettings[setting.tier] = setting.payout_percent;
    if (!tierSettings.updated_at || setting.updated_at.toISOString() > tierSettings.updated_at) {
      tierSettings.updated_at = setting.updated_at.toISOString();
    }
  }

  return tierSettings;
}

function normalizeName(value: string) {
  return value.trim();
}

function normalizePublisherName(value: string) {
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
