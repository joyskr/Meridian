import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import type { OrganizationActor } from '../memberships/membership-types.js';
import { OfferRepository } from './offer-repository.js';
import type {
  OfferEventDefinitionRecord,
  OfferStatus,
  OfferWithAdvertiserRecord
} from './offer-types.js';

const STANDARD_EVENT_CODES = new Set(['lead', 'registration', 'install', 'deposit', 'sale']);

export class OfferService {
  constructor(private readonly repository: OfferRepository) {}

  async listOffers(actor: OrganizationActor, status: OfferStatus | 'all') {
    ensureOfferReadAllowed(actor);

    const offers = await this.repository.listOffers(actor.organizationId, status);
    const eventCounts = await Promise.all(
      offers.map(async (offer) => ({
        offerId: offer.id,
        count: (await this.repository.listOfferEventDefinitions(offer.id)).length
      }))
    );
    const eventCountMap = new Map(eventCounts.map((item) => [item.offerId, item.count]));

    return {
      offers: offers.map((offer) => presentOfferListItem(offer, eventCountMap.get(offer.id) ?? 0))
    };
  }

  async getOffer(actor: OrganizationActor, offerId: string) {
    const offer = await this.requireOffer(actor.organizationId, offerId);
    ensureOfferReadAllowed(actor);
    const eventDefinitions = await this.repository.listOfferEventDefinitions(offer.id);

    return {
      offer: presentOffer(offer, eventDefinitions)
    };
  }

  async createOffer(
    actor: OrganizationActor,
    input: {
      advertiserId: string;
      name: string;
      description: string | null;
      trackingSlug: string | null;
      terms: string | null;
      startAt: string | null;
      endAt: string | null;
      dailyCap: number | null;
      monthlyCap: number | null;
      overallCap: number | null;
      eventDefinitions: Array<{
        eventCode: string;
        eventName: string;
        advertiserPayout: string;
      }>;
    }
  ) {
    ensureOfferWriteAllowed(actor);

    await this.requireActiveAdvertiser(actor.organizationId, input.advertiserId);

    const name = normalizeName(input.name);
    await this.ensureOfferNameAvailable(actor.organizationId, input.advertiserId, name);
    const offerWindow = parseOfferWindow(input.startAt, input.endAt);
    const eventDefinitions = normalizeEventDefinitions(input.eventDefinitions);

    const created = await this.repository.withTransaction(async (repository) => {
      const offer = await repository.createOffer({
        id: createPublicId('off'),
        organizationId: actor.organizationId,
        advertiserId: input.advertiserId,
        name,
        normalizedName: normalizeOfferName(name),
        description: normalizeNullable(input.description),
        trackingSlug: normalizeTrackingSlug(input.trackingSlug),
        terms: normalizeNullable(input.terms),
        startAt: offerWindow.startAt,
        endAt: offerWindow.endAt,
        dailyCap: input.dailyCap,
        monthlyCap: input.monthlyCap,
        overallCap: input.overallCap
      });

      await repository.replaceEventDefinitions(
        offer.id,
        eventDefinitions.map((definition) => ({
          id: createPublicId('evt'),
          eventCode: definition.eventCode,
          eventName: definition.eventName,
          advertiserPayout: definition.advertiserPayout
        }))
      );

      return offer.id;
    });

    return this.getOffer(actor, created);
  }

  async updateOffer(
    actor: OrganizationActor,
    offerId: string,
    input: {
      advertiserId?: string;
      name?: string;
      description?: string | null;
      trackingSlug?: string | null;
      terms?: string | null;
      startAt?: string | null;
      endAt?: string | null;
      dailyCap?: number | null;
      monthlyCap?: number | null;
      overallCap?: number | null;
      eventDefinitions?: Array<{
        eventCode: string;
        eventName: string;
        advertiserPayout: string;
      }>;
    }
  ) {
    ensureOfferWriteAllowed(actor);

    const offer = await this.requireOffer(actor.organizationId, offerId);

    if (offer.status === 'archived') {
      throw new AppError(
        'offer_archived',
        'business_rule',
        'Archived offers must be restored before they can be updated',
        422
      );
    }

    const nextAdvertiserId = input.advertiserId ?? offer.advertiser_id;
    if (input.advertiserId !== undefined) {
      await this.requireActiveAdvertiser(actor.organizationId, input.advertiserId);
    }

    const nextName = input.name !== undefined ? normalizeName(input.name) : offer.name;
    await this.ensureOfferNameAvailable(actor.organizationId, nextAdvertiserId, nextName, offer.id);

    const offerWindow = parseOfferWindow(
      input.startAt !== undefined ? input.startAt : offer.start_at ? offer.start_at.toISOString() : null,
      input.endAt !== undefined ? input.endAt : offer.end_at ? offer.end_at.toISOString() : null
    );
    const eventDefinitions =
      input.eventDefinitions === undefined ? null : normalizeEventDefinitions(input.eventDefinitions);

    await this.repository.withTransaction(async (repository) => {
      await repository.updateOffer({
        id: offer.id,
        advertiserId: nextAdvertiserId,
        name: nextName,
        normalizedName: normalizeOfferName(nextName),
        description:
          input.description !== undefined ? normalizeNullable(input.description) : offer.description,
        trackingSlug:
          input.trackingSlug !== undefined
            ? normalizeTrackingSlug(input.trackingSlug)
            : offer.tracking_slug,
        terms: input.terms !== undefined ? normalizeNullable(input.terms) : offer.terms,
        startAt: offerWindow.startAt,
        endAt: offerWindow.endAt,
        dailyCap: input.dailyCap !== undefined ? input.dailyCap : offer.daily_cap,
        monthlyCap: input.monthlyCap !== undefined ? input.monthlyCap : offer.monthly_cap,
        overallCap: input.overallCap !== undefined ? input.overallCap : offer.overall_cap
      });

      if (eventDefinitions) {
        await repository.replaceEventDefinitions(
          offer.id,
          eventDefinitions.map((definition) => ({
            id: createPublicId('evt'),
            eventCode: definition.eventCode,
            eventName: definition.eventName,
            advertiserPayout: definition.advertiserPayout
          }))
        );
      }
    });

    return this.getOffer(actor, offer.id);
  }

  async activateOffer(actor: OrganizationActor, offerId: string) {
    ensureOfferWriteAllowed(actor);

    const offer = await this.requireOffer(actor.organizationId, offerId);

    if (offer.status === 'active') {
      return this.getOffer(actor, offer.id);
    }

    if (offer.status !== 'draft') {
      throw new AppError(
        'offer_activate_invalid_state',
        'business_rule',
        'Only draft offers can be activated',
        422
      );
    }

    await this.requireActiveAdvertiser(actor.organizationId, offer.advertiser_id);
    const eventDefinitions = await this.repository.listOfferEventDefinitions(offer.id);

    if (eventDefinitions.length === 0) {
      throw new AppError(
        'offer_event_definitions_required',
        'business_rule',
        'Offers must define at least one event before activation',
        422
      );
    }

    await this.repository.updateOfferStatus(offer.id, 'active', null);
    return this.getOffer(actor, offer.id);
  }

  async pauseOffer(actor: OrganizationActor, offerId: string) {
    ensureOfferWriteAllowed(actor);

    const offer = await this.requireOffer(actor.organizationId, offerId);

    if (offer.status === 'paused') {
      return this.getOffer(actor, offer.id);
    }

    if (offer.status !== 'active') {
      throw new AppError(
        'offer_pause_invalid_state',
        'business_rule',
        'Only active offers can be paused',
        422
      );
    }

    await this.repository.updateOfferStatus(offer.id, 'paused', null);
    return this.getOffer(actor, offer.id);
  }

  async resumeOffer(actor: OrganizationActor, offerId: string) {
    ensureOfferWriteAllowed(actor);

    const offer = await this.requireOffer(actor.organizationId, offerId);

    if (offer.status === 'active') {
      return this.getOffer(actor, offer.id);
    }

    if (offer.status !== 'paused') {
      throw new AppError(
        'offer_resume_invalid_state',
        'business_rule',
        'Only paused offers can be resumed',
        422
      );
    }

    await this.requireActiveAdvertiser(actor.organizationId, offer.advertiser_id);
    await this.repository.updateOfferStatus(offer.id, 'active', null);
    return this.getOffer(actor, offer.id);
  }

  async archiveOffer(actor: OrganizationActor, offerId: string) {
    ensureOfferWriteAllowed(actor);

    const offer = await this.requireOffer(actor.organizationId, offerId);

    if (offer.status === 'archived') {
      return this.getOffer(actor, offer.id);
    }

    await this.repository.updateOfferStatus(offer.id, 'archived', new Date());
    return this.getOffer(actor, offer.id);
  }

  async restoreOffer(actor: OrganizationActor, offerId: string) {
    ensureOfferWriteAllowed(actor);

    const offer = await this.requireOffer(actor.organizationId, offerId);

    if (offer.status !== 'archived') {
      return this.getOffer(actor, offer.id);
    }

    await this.ensureOfferNameAvailable(actor.organizationId, offer.advertiser_id, offer.name, offer.id);
    await this.repository.updateOfferStatus(offer.id, 'draft', null);
    return this.getOffer(actor, offer.id);
  }

  private async requireOffer(organizationId: string, offerId: string) {
    const offer = await this.repository.findOffer(organizationId, offerId);

    if (!offer) {
      throw new AppError('offer_not_found', 'not_found', 'Offer not found', 404);
    }

    return offer;
  }

  private async requireActiveAdvertiser(organizationId: string, advertiserId: string) {
    const advertiser = await this.repository.findAdvertiserSummary(organizationId, advertiserId);

    if (!advertiser) {
      throw new AppError('advertiser_not_found', 'not_found', 'Advertiser not found', 404);
    }

    if (advertiser.status !== 'active') {
      throw new AppError(
        'advertiser_inactive',
        'business_rule',
        'Offers may only be linked to active advertisers',
        422
      );
    }

    return advertiser;
  }

  private async ensureOfferNameAvailable(
    organizationId: string,
    advertiserId: string,
    name: string,
    excludedOfferId: string | null = null
  ) {
    const duplicate = await this.repository.findActiveDuplicateByNormalizedName(
      organizationId,
      advertiserId,
      normalizeOfferName(name),
      excludedOfferId
    );

    if (duplicate) {
      throw new AppError(
        'offer_duplicate_name',
        'conflict',
        'An active or paused offer with this name already exists for this advertiser',
        409
      );
    }
  }
}

function ensureOfferReadAllowed(actor: OrganizationActor) {
  if (
    actor.membership.role === 'owner' ||
    actor.membership.role === 'admin' ||
    actor.membership.role === 'manager' ||
    actor.membership.role === 'analyst' ||
    actor.membership.role === 'viewer'
  ) {
    return;
  }

  throw new AppError(
    'offer_read_forbidden',
    'authorization',
    'Current membership cannot read offers',
    403
  );
}

function ensureOfferWriteAllowed(actor: OrganizationActor) {
  if (
    actor.membership.role === 'owner' ||
    actor.membership.role === 'admin' ||
    actor.membership.role === 'manager'
  ) {
    return;
  }

  throw new AppError(
    'offer_write_forbidden',
    'authorization',
    'Current membership cannot modify offers',
    403
  );
}

function presentOfferListItem(offer: OfferWithAdvertiserRecord, eventCount: number) {
  return {
    id: offer.id,
    advertiser: {
      id: offer.advertiser_id,
      name: offer.advertiser_name
    },
    name: offer.name,
    tracking_slug: offer.tracking_slug,
    status: offer.status,
    event_count: eventCount,
    created_at: offer.created_at.toISOString(),
    updated_at: offer.updated_at.toISOString()
  };
}

function presentOffer(offer: OfferWithAdvertiserRecord, eventDefinitions: OfferEventDefinitionRecord[]) {
  return {
    id: offer.id,
    advertiser: {
      id: offer.advertiser_id,
      name: offer.advertiser_name
    },
    name: offer.name,
    description: offer.description,
    tracking_slug: offer.tracking_slug,
    terms: offer.terms,
    start_at: offer.start_at ? offer.start_at.toISOString() : null,
    end_at: offer.end_at ? offer.end_at.toISOString() : null,
    daily_cap: offer.daily_cap,
    monthly_cap: offer.monthly_cap,
    overall_cap: offer.overall_cap,
    status: offer.status,
    archived_at: offer.archived_at ? offer.archived_at.toISOString() : null,
    created_at: offer.created_at.toISOString(),
    updated_at: offer.updated_at.toISOString(),
    event_definitions: eventDefinitions.map((definition) => ({
      id: definition.id,
      event_code: definition.event_code,
      event_name: definition.event_name,
      advertiser_payout: definition.advertiser_payout
    }))
  };
}

function normalizeName(value: string) {
  return value.trim();
}

function normalizeOfferName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeNullable(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeTrackingSlug(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}

function parseOfferWindow(startAt: string | null, endAt: string | null) {
  const parsedStartAt = startAt ? new Date(startAt) : null;
  const parsedEndAt = endAt ? new Date(endAt) : null;

  if (parsedStartAt && parsedEndAt && parsedStartAt.getTime() > parsedEndAt.getTime()) {
    throw new AppError(
      'offer_invalid_window',
      'validation',
      'Offer start date must be before or equal to end date',
      400,
      {
        issues: [
          {
            path: 'end_at',
            message: 'Offer start date must be before or equal to end date',
            code: 'custom'
          }
        ]
      }
    );
  }

  return {
    startAt: parsedStartAt,
    endAt: parsedEndAt
  };
}

function normalizeEventDefinitions(
  eventDefinitions: Array<{
    eventCode: string;
    eventName: string;
    advertiserPayout: string;
  }>
) {
  const normalized = eventDefinitions.map((definition) => ({
    eventCode: definition.eventCode.trim().toLowerCase(),
    eventName: definition.eventName.trim(),
    advertiserPayout: definition.advertiserPayout.trim(),
    standard: STANDARD_EVENT_CODES.has(definition.eventCode.trim().toLowerCase())
  }));

  const seen = new Set<string>();
  for (const definition of normalized) {
    if (seen.has(definition.eventCode)) {
      throw new AppError(
        'offer_duplicate_event_code',
        'validation',
        'Event code must be unique within the offer',
        400,
        {
          issues: [
            {
              path: 'event_definitions',
              message: `Duplicate event code: ${definition.eventCode}`,
              code: 'custom'
            }
          ]
        }
      );
    }

    seen.add(definition.eventCode);
  }

  return normalized.map(({ eventCode, eventName, advertiserPayout }) => ({
    eventCode,
    eventName,
    advertiserPayout
  }));
}
