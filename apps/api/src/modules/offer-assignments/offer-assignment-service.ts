import { AppError } from '../../platform/http/shared-error.js';
import { createPublicId } from '../../platform/security/ids.js';
import { createOpaqueToken } from '../../platform/security/token.js';
import type { OrganizationActor } from '../memberships/membership-types.js';
import type { PublisherTier } from '../publishers/publisher-types.js';
import { OfferAssignmentRepository } from './offer-assignment-repository.js';
import type {
  OfferAssignmentPayoutOverrideWithEventRecord,
  OfferAssignmentStatus,
  OfferAssignmentWithRelationsRecord,
  OfferEventDefinitionForAssignmentRecord
} from './offer-assignment-types.js';

type TierPercentages = Record<PublisherTier, number>;

export class OfferAssignmentService {
  constructor(private readonly repository: OfferAssignmentRepository) {}

  async listAssignments(actor: OrganizationActor, status: OfferAssignmentStatus | 'all') {
    ensureAssignmentReadAllowed(actor);

    const [assignments, tierSettings] = await Promise.all([
      this.repository.listAssignments(actor.organizationId, status),
      this.repository.listTierSettings(actor.organizationId)
    ]);
    const tierPercentages = buildTierPercentages(tierSettings);

    return {
      assignments: await Promise.all(
        assignments.map(async (assignment) =>
          presentAssignmentListItem(
            assignment,
            await this.repository.listPayoutOverrides(assignment.id),
            tierPercentages
          )
        )
      )
    };
  }

  async getAssignment(actor: OrganizationActor, assignmentId: string) {
    ensureAssignmentReadAllowed(actor);

    const assignment = await this.requireAssignment(actor.organizationId, assignmentId);

    const [payoutOverrides, tierSettings] = await Promise.all([
      this.repository.listPayoutOverrides(assignment.id),
      this.repository.listTierSettings(actor.organizationId)
    ]);

    return {
      assignment: presentAssignmentDetail(assignment, payoutOverrides, buildTierPercentages(tierSettings))
    };
  }

  async createAssignment(
    actor: OrganizationActor,
    input: {
      offerId: string;
      publisherId: string;
      redirectUrl: string;
      conversionVisibilityPercent: number | null;
      postbackPercent: number | null;
      payoutOverrides: Array<{
        eventCode: string;
        publisherPayoutAmount: string;
      }>;
    }
  ) {
    ensureAssignmentWriteAllowed(actor);

    const [offer, publisher] = await Promise.all([
      this.requireAssignableOffer(actor.organizationId, input.offerId),
      this.requireAssignablePublisher(actor.organizationId, input.publisherId)
    ]);

    await this.ensureAssignmentPairAvailable(actor.organizationId, offer.id, publisher.id);
    const eventDefinitions = await this.repository.listOfferEventDefinitions(offer.id);
    validateOverrideEventCodes(input.payoutOverrides, eventDefinitions);

    const assignmentId = await this.repository.withTransaction(async (repository) => {
      const assignment = await repository.createAssignment({
        id: createPublicId('asg'),
        organizationId: actor.organizationId,
        offerId: offer.id,
        publisherId: publisher.id,
        trackingToken: createOpaqueToken(),
        redirectUrl: input.redirectUrl.trim(),
        conversionVisibilityPercent: input.conversionVisibilityPercent ?? 100,
        postbackPercent: input.postbackPercent ?? 100
      });

      await repository.replacePayoutOverrides(
        actor.organizationId,
        assignment.id,
        input.payoutOverrides.map((override) => ({
          id: createPublicId('aov'),
          eventCode: override.eventCode,
          publisherPayoutAmount: override.publisherPayoutAmount
        }))
      );

      return assignment.id;
    });

    return this.getAssignment(actor, assignmentId);
  }

  async updateAssignment(
    actor: OrganizationActor,
    assignmentId: string,
    input: {
      redirectUrl?: string;
      conversionVisibilityPercent?: number | null;
      postbackPercent?: number | null;
      payoutOverrides?: Array<{
        eventCode: string;
        publisherPayoutAmount: string;
      }>;
    }
  ) {
    ensureAssignmentWriteAllowed(actor);

    const assignment = await this.requireAssignment(actor.organizationId, assignmentId);

    if (assignment.status === 'archived') {
      throw new AppError(
        'offer_assignment_archived',
        'business_rule',
        'Archived assignments must be restored before they can be updated',
        422
      );
    }

    await Promise.all([
      this.requireAssignableOffer(actor.organizationId, assignment.offer_id),
      this.requireAssignablePublisher(actor.organizationId, assignment.publisher_id)
    ]);

    const eventDefinitions = await this.repository.listOfferEventDefinitions(assignment.offer_id);
    if (input.payoutOverrides) {
      validateOverrideEventCodes(input.payoutOverrides, eventDefinitions);
    }

    await this.repository.withTransaction(async (repository) => {
      await repository.updateAssignment({
        id: assignment.id,
        redirectUrl: resolveRedirectUrl(input.redirectUrl, assignment.redirect_url),
        conversionVisibilityPercent:
          input.conversionVisibilityPercent ?? assignment.conversion_visibility_percent,
        postbackPercent: input.postbackPercent ?? assignment.postback_percent
      });

      if (input.payoutOverrides) {
        await repository.replacePayoutOverrides(
          actor.organizationId,
          assignment.id,
          input.payoutOverrides.map((override) => ({
            id: createPublicId('aov'),
            eventCode: override.eventCode,
            publisherPayoutAmount: override.publisherPayoutAmount
          }))
        );
      }
    });

    return this.getAssignment(actor, assignment.id);
  }

  async pauseAssignment(actor: OrganizationActor, assignmentId: string) {
    ensureAssignmentWriteAllowed(actor);

    const assignment = await this.requireAssignment(actor.organizationId, assignmentId);
    if (assignment.status === 'paused') {
      return this.getAssignment(actor, assignment.id);
    }

    if (assignment.status !== 'active') {
      throw new AppError(
        'offer_assignment_pause_invalid_state',
        'business_rule',
        'Only active assignments can be paused',
        422
      );
    }

    await this.repository.updateAssignmentStatus(assignment.id, 'paused', null);
    return this.getAssignment(actor, assignment.id);
  }

  async resumeAssignment(actor: OrganizationActor, assignmentId: string) {
    ensureAssignmentWriteAllowed(actor);

    const assignment = await this.requireAssignment(actor.organizationId, assignmentId);
    if (assignment.status === 'active') {
      return this.getAssignment(actor, assignment.id);
    }

    if (assignment.status !== 'paused') {
      throw new AppError(
        'offer_assignment_resume_invalid_state',
        'business_rule',
        'Only paused assignments can be resumed',
        422
      );
    }

    await Promise.all([
      this.requireAssignableOffer(actor.organizationId, assignment.offer_id),
      this.requireAssignablePublisher(actor.organizationId, assignment.publisher_id)
    ]);

    await this.repository.updateAssignmentStatus(assignment.id, 'active', null);
    return this.getAssignment(actor, assignment.id);
  }

  async archiveAssignment(actor: OrganizationActor, assignmentId: string) {
    ensureAssignmentWriteAllowed(actor);

    const assignment = await this.requireAssignment(actor.organizationId, assignmentId);
    if (assignment.status === 'archived') {
      return this.getAssignment(actor, assignment.id);
    }

    await this.repository.updateAssignmentStatus(assignment.id, 'archived', new Date());
    return this.getAssignment(actor, assignment.id);
  }

  async restoreAssignment(actor: OrganizationActor, assignmentId: string) {
    ensureAssignmentWriteAllowed(actor);

    const assignment = await this.requireAssignment(actor.organizationId, assignmentId);
    if (assignment.status !== 'archived') {
      return this.getAssignment(actor, assignment.id);
    }

    await Promise.all([
      this.requireAssignableOffer(actor.organizationId, assignment.offer_id),
      this.requireAssignablePublisher(actor.organizationId, assignment.publisher_id)
    ]);
    await this.ensureAssignmentPairAvailable(
      actor.organizationId,
      assignment.offer_id,
      assignment.publisher_id,
      assignment.id
    );

    await this.repository.updateAssignmentStatus(assignment.id, 'paused', null);
    return this.getAssignment(actor, assignment.id);
  }

  async getTrackingLink(actor: OrganizationActor, assignmentId: string) {
    ensureAssignmentReadAllowed(actor);
    const assignment = await this.requireAssignment(actor.organizationId, assignmentId);

    return {
      tracking_link: {
        assignment_id: assignment.id,
        tracking_path: buildTrackingPath(assignment.tracking_token)
      }
    };
  }

  private async requireAssignment(organizationId: string, assignmentId: string) {
    const assignment = await this.repository.findAssignment(organizationId, assignmentId);

    if (!assignment) {
      throw new AppError('offer_assignment_not_found', 'not_found', 'Offer assignment not found', 404);
    }

    return assignment;
  }

  private async requireAssignableOffer(organizationId: string, offerId: string) {
    const offer = await this.repository.findOfferSummary(organizationId, offerId);

    if (!offer) {
      throw new AppError('offer_not_found', 'not_found', 'Offer not found', 404);
    }

    if (offer.status === 'archived') {
      throw new AppError(
        'offer_archived',
        'business_rule',
        'Archived offers cannot be assigned to publishers',
        422
      );
    }

    return offer;
  }

  private async requireAssignablePublisher(organizationId: string, publisherId: string) {
    const publisher = await this.repository.findPublisherSummary(organizationId, publisherId);

    if (!publisher) {
      throw new AppError('publisher_not_found', 'not_found', 'Publisher not found', 404);
    }

    if (publisher.status !== 'active') {
      throw new AppError(
        'publisher_inactive',
        'business_rule',
        'Offer assignments may only target active publishers',
        422
      );
    }

    return publisher;
  }

  private async ensureAssignmentPairAvailable(
    organizationId: string,
    offerId: string,
    publisherId: string,
    excludedAssignmentId: string | null = null
  ) {
    const duplicate = await this.repository.findNonArchivedDuplicate(
      organizationId,
      offerId,
      publisherId,
      excludedAssignmentId
    );

    if (duplicate) {
      throw new AppError(
        'offer_assignment_duplicate_pair',
        'conflict',
        'A non-archived assignment already exists for this offer and publisher',
        409
      );
    }
  }
}

function ensureAssignmentReadAllowed(actor: OrganizationActor) {
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
    'offer_assignment_read_forbidden',
    'authorization',
    'Current membership cannot read offer assignments',
    403
  );
}

function ensureAssignmentWriteAllowed(actor: OrganizationActor) {
  if (
    actor.membership.role === 'owner' ||
    actor.membership.role === 'admin' ||
    actor.membership.role === 'manager'
  ) {
    return;
  }

  throw new AppError(
    'offer_assignment_write_forbidden',
    'authorization',
    'Current membership cannot modify offer assignments',
    403
  );
}

function buildTrackingPath(trackingToken: string) {
  return `/t/${trackingToken}`;
}

function buildTierPercentages(
  settings: Array<{
    tier: PublisherTier;
    payout_percent: number;
  }>
): TierPercentages {
  return {
    tier_1: settings.find((setting) => setting.tier === 'tier_1')?.payout_percent ?? 40,
    tier_2: settings.find((setting) => setting.tier === 'tier_2')?.payout_percent ?? 55,
    tier_3: settings.find((setting) => setting.tier === 'tier_3')?.payout_percent ?? 70,
    tier_4: settings.find((setting) => setting.tier === 'tier_4')?.payout_percent ?? 80
  };
}

function effectivePostbackPercent(assignment: OfferAssignmentWithRelationsRecord) {
  return Math.min(assignment.publisher_postback_percent, assignment.postback_percent);
}

async function presentAssignmentListItem(
  assignment: OfferAssignmentWithRelationsRecord,
  payoutOverrides: OfferAssignmentPayoutOverrideWithEventRecord[],
  tierPercentages: TierPercentages
) {
  return {
    id: assignment.id,
    offer: {
      id: assignment.offer_id,
      name: assignment.offer_name
    },
    publisher: {
      id: assignment.publisher_id,
      name: assignment.publisher_name,
      publisher_tier: assignment.publisher_tier,
      publisher_postback_percent: assignment.publisher_postback_percent,
      tier_payout_percent: tierPercentages[assignment.publisher_tier]
    },
    conversion_visibility_percent: assignment.conversion_visibility_percent,
    postback_percent: assignment.postback_percent,
    effective_postback_percent: effectivePostbackPercent(assignment),
    redirect_url: assignment.redirect_url,
    payout_override_count: payoutOverrides.length,
    status: assignment.status,
    created_at: assignment.created_at.toISOString(),
    updated_at: assignment.updated_at.toISOString()
  };
}

function presentAssignmentDetail(
  assignment: OfferAssignmentWithRelationsRecord,
  payoutOverrides: OfferAssignmentPayoutOverrideWithEventRecord[],
  tierPercentages: TierPercentages
) {
  return {
    id: assignment.id,
    offer: {
      id: assignment.offer_id,
      name: assignment.offer_name,
      status: assignment.offer_status
    },
    publisher: {
      id: assignment.publisher_id,
      name: assignment.publisher_name,
      status: assignment.publisher_status,
      publisher_tier: assignment.publisher_tier,
      publisher_postback_percent: assignment.publisher_postback_percent,
      tier_payout_percent: tierPercentages[assignment.publisher_tier]
    },
    conversion_visibility_percent: assignment.conversion_visibility_percent,
    postback_percent: assignment.postback_percent,
    effective_postback_percent: effectivePostbackPercent(assignment),
    redirect_url: assignment.redirect_url,
    payout_overrides: payoutOverrides.map((override) => ({
      id: override.id,
      event_code: override.event_code,
      event_name: override.event_name,
      publisher_payout_amount: override.publisher_payout_amount
    })),
    tracking_link: {
      tracking_path: buildTrackingPath(assignment.tracking_token)
    },
    status: assignment.status,
    archived_at: assignment.archived_at ? assignment.archived_at.toISOString() : null,
    created_at: assignment.created_at.toISOString(),
    updated_at: assignment.updated_at.toISOString()
  };
}

function validateOverrideEventCodes(
  payoutOverrides: Array<{ eventCode: string }>,
  eventDefinitions: OfferEventDefinitionForAssignmentRecord[]
) {
  const allowedEventCodes = new Set(eventDefinitions.map((definition) => definition.event_code));

  for (const override of payoutOverrides) {
    if (!allowedEventCodes.has(override.eventCode)) {
      throw new AppError(
        'offer_assignment_override_event_not_found',
        'validation',
        'Payout overrides must reference event codes defined on the offer',
        400,
        {
          issues: [
            {
              path: 'payout_overrides',
              message: `Unknown offer event code: ${override.eventCode}`,
              code: 'custom'
            }
          ]
        }
      );
    }
  }
}

function resolveRedirectUrl(nextRedirectUrl: string | undefined, currentRedirectUrl: string | null) {
  const resolved = nextRedirectUrl?.trim() ?? currentRedirectUrl;

  if (!resolved) {
    throw new AppError(
      'offer_assignment_redirect_url_required',
      'business_rule',
      'Offer assignments must keep a redirect URL configured',
      422
    );
  }

  return resolved;
}
