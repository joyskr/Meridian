'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  Advertiser,
  CurrentOrganizationResponse,
  ListAdvertisersResponse,
  ListOffersResponse,
  Offer,
  OfferDetailResponse,
  OfferEventDefinition,
  CreateOfferRequest,
  UpdateOfferRequest
} from '@meridian/contracts';
import { apiFetch, getErrorMessage } from '../../lib/api';

type SessionResponse = {
  user: {
    email: string;
  };
};

type OfferEventDefinitionFormState = {
  event_code: string;
  event_name: string;
  advertiser_payout: string;
};

type OfferFormState = {
  advertiser_id: string;
  name: string;
  description: string;
  tracking_slug: string;
  terms: string;
  start_at: string;
  end_at: string;
  daily_cap: string;
  monthly_cap: string;
  overall_cap: string;
  event_definitions: OfferEventDefinitionFormState[];
};

const EMPTY_EVENT: OfferEventDefinitionFormState = {
  event_code: '',
  event_name: '',
  advertiser_payout: ''
};

const EMPTY_FORM: OfferFormState = {
  advertiser_id: '',
  name: '',
  description: '',
  tracking_slug: '',
  terms: '',
  start_at: '',
  end_at: '',
  daily_cap: '',
  monthly_cap: '',
  overall_cap: '',
  event_definitions: [{ ...EMPTY_EVENT }]
};

const STATUS_OPTIONS: Array<'draft' | 'active' | 'paused' | 'archived' | 'all'> = [
  'all',
  'draft',
  'active',
  'paused',
  'archived'
];

export function OffersClient() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<CurrentOrganizationResponse | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [offers, setOffers] = useState<ListOffersResponse['offers']>([]);
  const [selectedOffer, setSelectedOffer] = useState<OfferDetailResponse | null>(null);
  const [createForm, setCreateForm] = useState<OfferFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<OfferFormState>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<'draft' | 'active' | 'paused' | 'archived' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOfferState();
  }, []);

  async function loadOfferState(
    nextStatusFilter: 'draft' | 'active' | 'paused' | 'archived' | 'all' = statusFilter,
    selectedOfferId?: string
  ) {
    setLoading(true);
    setError(null);

    try {
      const [sessionResponse, currentResponse] = await Promise.all([
        apiFetch<SessionResponse>('/auth/session'),
        apiFetch<CurrentOrganizationResponse>('/organizations/current')
      ]);

      setSessionEmail(sessionResponse.user.email);
      setCurrentOrganization(currentResponse);
      setStatusFilter(nextStatusFilter);

      if (!currentResponse.organization) {
        setAdvertisers([]);
        setOffers([]);
        setSelectedOffer(null);
        return;
      }

      const [advertisersResponse, offersResponse] = await Promise.all([
        apiFetch<ListAdvertisersResponse>('/advertisers?status=active'),
        apiFetch<ListOffersResponse>(`/offers?status=${encodeURIComponent(nextStatusFilter)}`)
      ]);

      setAdvertisers(advertisersResponse.advertisers);
      setOffers(offersResponse.offers);

      setCreateForm((previous) => ({
        ...previous,
        advertiser_id:
          previous.advertiser_id || advertisersResponse.advertisers[0]?.id || ''
      }));

      const nextSelectedOfferId =
        selectedOfferId ?? selectedOffer?.offer.id ?? offersResponse.offers[0]?.id;

      if (nextSelectedOfferId) {
        const detailResponse = await apiFetch<OfferDetailResponse>(`/offers/${nextSelectedOfferId}`);
        setSelectedOffer(detailResponse);
        setEditForm(toFormState(detailResponse.offer));
      } else {
        setSelectedOffer(null);
        setEditForm(EMPTY_FORM);
      }
    } catch (requestError) {
      setSessionEmail(null);
      setCurrentOrganization(null);
      setAdvertisers([]);
      setOffers([]);
      setSelectedOffer(null);
      setEditForm(EMPTY_FORM);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectOffer(offerId: string) {
    setSubmitting(true);
    setError(null);

    try {
      const detailResponse = await apiFetch<OfferDetailResponse>(`/offers/${offerId}`);
      setSelectedOffer(detailResponse);
      setEditForm(toFormState(detailResponse.offer));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<OfferDetailResponse>('/offers', {
        method: 'POST',
        body: JSON.stringify(toCreatePayload(createForm))
      });

      setCreateForm({
        ...EMPTY_FORM,
        advertiser_id: createForm.advertiser_id || advertisers[0]?.id || ''
      });
      await loadOfferState(statusFilter, response.offer.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOffer) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<OfferDetailResponse>(`/offers/${selectedOffer.offer.id}`, {
        method: 'PATCH',
        body: JSON.stringify(toUpdatePayload(editForm))
      });

      setSelectedOffer(response);
      setEditForm(toFormState(response.offer));
      await loadOfferState(statusFilter, response.offer.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLifecycleAction(path: string) {
    if (!selectedOffer) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<OfferDetailResponse>(path, {
        method: 'POST'
      });

      setSelectedOffer(response);
      setEditForm(toFormState(response.offer));
      await loadOfferState(statusFilter, response.offer.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const currentRole = currentOrganization?.membership?.role ?? null;
  const canManageOffers =
    currentRole === 'owner' || currentRole === 'admin' || currentRole === 'manager';

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Phase 4.1</p>
          <h1 className="hero__title">Offer core management.</h1>
          <p className="hero__copy">
            Offers stay advertiser-owned, event-based, and lifecycle-controlled in the Node API.
            Tracking slug is stored for operators, but attribution and tracking remain assignment-driven.
          </p>

          <div className="panel-grid">
            <article className="panel">
              <h2>Session</h2>
              {loading ? <p>Loading session...</p> : <p>{sessionEmail ?? 'No authenticated API session.'}</p>}
              <p className="panel__muted">Current role: {currentRole ?? 'No active organization'}</p>
            </article>

            <article className="panel">
              <h2>Current Organization</h2>
              {loading ? <p>Loading organization...</p> : null}
              {!loading && currentOrganization?.organization ? (
                <>
                  <p>{currentOrganization.organization.name}</p>
                  <p className="panel__muted">
                    Offer writes: {canManageOffers ? 'manager+' : 'read-only or unavailable'}
                  </p>
                </>
              ) : null}
              {!loading && !currentOrganization?.organization ? (
                <p className="panel__muted">Select or create an organization before managing offers.</p>
              ) : null}
            </article>
          </div>

          <div className="panel-grid">
            <article className="panel">
              <h2>Offers</h2>
              <label className="form-field">
                <span>Status filter</span>
                <select
                  className="text-input"
                  value={statusFilter}
                  disabled={loading || submitting}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    void loadOfferState(
                      event.target.value as 'draft' | 'active' | 'paused' | 'archived' | 'all'
                    )
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {loading ? <p>Loading offers...</p> : null}
              {!loading && offers.length === 0 ? (
                <p className="panel__muted">No offers match the current filter.</p>
              ) : null}
              {!loading && offers.length > 0 ? (
                <div className="organization-list">
                  {offers.map((offer) => (
                    <button
                      className="organization-item organization-item--button"
                      key={offer.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSelectOffer(offer.id)}
                    >
                      <div>
                        <strong>{offer.name}</strong>
                        <p className="panel__muted">
                          {offer.advertiser.name} | {offer.status} | {offer.event_count} events
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="panel">
              <h2>Create Offer</h2>
              {!canManageOffers ? (
                <p className="panel__muted">
                  Offer creation is available only to manager, admin, or owner roles.
                </p>
              ) : advertisers.length === 0 ? (
                <p className="panel__muted">
                  Create an active advertiser before creating offers.
                </p>
              ) : (
                <form className="form-stack" onSubmit={(event) => void handleCreateOffer(event)}>
                  <OfferFormFields
                    advertisers={advertisers}
                    form={createForm}
                    disabled={submitting}
                    onChange={setCreateForm}
                  />
                  <div className="form-actions">
                    <button className="button button--primary" type="submit" disabled={submitting}>
                      {submitting ? 'Saving...' : 'Create offer'}
                    </button>
                  </div>
                </form>
              )}
            </article>
          </div>

          <article className="panel">
            <h2>Selected Offer</h2>
            {loading ? <p>Loading offer...</p> : null}
            {!loading && !selectedOffer ? (
              <p className="panel__muted">Select an offer to inspect or edit it.</p>
            ) : null}
            {!loading && selectedOffer ? (
              <div className="form-stack">
                <div className="detail-list">
                  <p>
                    <strong>Name:</strong> {selectedOffer.offer.name}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedOffer.offer.status}
                  </p>
                  <p>
                    <strong>Advertiser:</strong> {selectedOffer.offer.advertiser.name}
                  </p>
                  <p>
                    <strong>Tracking slug:</strong> {selectedOffer.offer.tracking_slug ?? 'Not set'}
                  </p>
                  <p>
                    <strong>Visibility:</strong> All organization members with offer read access
                  </p>
                </div>

                {canManageOffers ? (
                  <>
                    <form className="form-stack" onSubmit={(event) => void handleUpdateOffer(event)}>
                      <OfferFormFields
                        advertisers={advertisers}
                        form={editForm}
                        disabled={submitting || selectedOffer.offer.status === 'archived'}
                        onChange={setEditForm}
                      />
                      <div className="form-actions">
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={submitting || selectedOffer.offer.status === 'archived'}
                        >
                          {submitting ? 'Saving...' : 'Update offer'}
                        </button>
                      </div>
                    </form>

                    <div className="form-actions">
                      {selectedOffer.offer.status === 'draft' ? (
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offers/${selectedOffer.offer.id}/activate`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Activate offer'}
                        </button>
                      ) : null}

                      {selectedOffer.offer.status === 'active' ? (
                        <button
                          className="button"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offers/${selectedOffer.offer.id}/pause`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Pause offer'}
                        </button>
                      ) : null}

                      {selectedOffer.offer.status === 'paused' ? (
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offers/${selectedOffer.offer.id}/resume`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Resume offer'}
                        </button>
                      ) : null}

                      {selectedOffer.offer.status === 'archived' ? (
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offers/${selectedOffer.offer.id}/restore`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Restore offer'}
                        </button>
                      ) : (
                        <button
                          className="button button--danger"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offers/${selectedOffer.offer.id}/archive`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Archive offer'}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                <p className="panel__muted">
                    This role cannot modify offers.
                  </p>
                )}
              </div>
            ) : null}
          </article>

          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

function OfferFormFields({
  advertisers,
  form,
  disabled,
  onChange
}: {
  advertisers: Advertiser[];
  form: OfferFormState;
  disabled: boolean;
  onChange: (next: OfferFormState) => void;
}) {
  function updateField<Key extends keyof OfferFormState>(key: Key, value: OfferFormState[Key]) {
    onChange({
      ...form,
      [key]: value
    });
  }

  function updateEvent(index: number, nextEvent: OfferEventDefinitionFormState) {
    const nextEvents = [...form.event_definitions];
    nextEvents[index] = nextEvent;
    updateField('event_definitions', nextEvents);
  }

  function addEvent() {
    updateField('event_definitions', [...form.event_definitions, { ...EMPTY_EVENT }]);
  }

  function removeEvent(index: number) {
    if (form.event_definitions.length === 1) {
      updateField('event_definitions', [{ ...EMPTY_EVENT }]);
      return;
    }

    updateField(
      'event_definitions',
      form.event_definitions.filter((_, eventIndex) => eventIndex !== index)
    );
  }

  return (
    <>
      <label className="form-field">
        <span>Advertiser</span>
        <select
          className="text-input"
          value={form.advertiser_id}
          disabled={disabled}
          onChange={(event) => updateField('advertiser_id', event.target.value)}
          required
        >
          <option value="" disabled>
            Select advertiser
          </option>
          {advertisers.map((advertiser) => (
            <option key={advertiser.id} value={advertiser.id}>
              {advertiser.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field">
        <span>Name</span>
        <input
          className="text-input"
          value={form.name}
          disabled={disabled}
          onChange={(event) => updateField('name', event.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span>Tracking slug</span>
        <input
          className="text-input"
          value={form.tracking_slug}
          disabled={disabled}
          onChange={(event) => updateField('tracking_slug', event.target.value)}
          placeholder="informational-only-slug"
        />
      </label>
      <label className="form-field">
        <span>Description</span>
        <textarea
          className="text-input text-area"
          value={form.description}
          disabled={disabled}
          onChange={(event) => updateField('description', event.target.value)}
          rows={3}
        />
      </label>
      <label className="form-field">
        <span>Terms</span>
        <textarea
          className="text-input text-area"
          value={form.terms}
          disabled={disabled}
          onChange={(event) => updateField('terms', event.target.value)}
          rows={3}
        />
      </label>

      <div className="panel-grid">
        <label className="form-field">
          <span>Start at</span>
          <input
            className="text-input"
            type="datetime-local"
            value={form.start_at}
            disabled={disabled}
            onChange={(event) => updateField('start_at', event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>End at</span>
          <input
            className="text-input"
            type="datetime-local"
            value={form.end_at}
            disabled={disabled}
            onChange={(event) => updateField('end_at', event.target.value)}
          />
        </label>
      </div>

      <div className="panel-grid">
        <label className="form-field">
          <span>Daily cap</span>
          <input
            className="text-input"
            type="number"
            min="0"
            value={form.daily_cap}
            disabled={disabled}
            onChange={(event) => updateField('daily_cap', event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Monthly cap</span>
          <input
            className="text-input"
            type="number"
            min="0"
            value={form.monthly_cap}
            disabled={disabled}
            onChange={(event) => updateField('monthly_cap', event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Overall cap</span>
          <input
            className="text-input"
            type="number"
            min="0"
            value={form.overall_cap}
            disabled={disabled}
            onChange={(event) => updateField('overall_cap', event.target.value)}
          />
        </label>
      </div>

      <div className="form-stack">
        <div className="detail-list">
          <p>
            <strong>Event definitions</strong>
          </p>
          <p className="panel__muted">
            Event codes are explicit offer-defined machine identifiers. Tracking slug is not used for attribution.
          </p>
        </div>
        {form.event_definitions.map((eventDefinition, index) => (
          <div className="panel" key={`${eventDefinition.event_code}-${index}`}>
            <div className="panel-grid">
              <label className="form-field">
                <span>Event code</span>
                <input
                  className="text-input"
                  value={eventDefinition.event_code}
                  disabled={disabled}
                  onChange={(event) =>
                    updateEvent(index, {
                      ...eventDefinition,
                      event_code: event.target.value
                    })
                  }
                  placeholder="sale"
                  required
                />
              </label>
              <label className="form-field">
                <span>Event name</span>
                <input
                  className="text-input"
                  value={eventDefinition.event_name}
                  disabled={disabled}
                  onChange={(event) =>
                    updateEvent(index, {
                      ...eventDefinition,
                      event_name: event.target.value
                    })
                  }
                  placeholder="Sale"
                  required
                />
              </label>
              <label className="form-field">
                <span>Advertiser payout</span>
                <input
                  className="text-input"
                  value={eventDefinition.advertiser_payout}
                  disabled={disabled}
                  onChange={(event) =>
                    updateEvent(index, {
                      ...eventDefinition,
                      advertiser_payout: event.target.value
                    })
                  }
                  placeholder="10.00"
                  required
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="button button--danger" type="button" disabled={disabled} onClick={() => removeEvent(index)}>
                Remove event
              </button>
            </div>
          </div>
        ))}
        <div className="form-actions">
          <button className="button" type="button" disabled={disabled} onClick={addEvent}>
            Add event definition
          </button>
        </div>
      </div>
    </>
  );
}

function toCreatePayload(form: OfferFormState): CreateOfferRequest {
  return {
    advertiser_id: form.advertiser_id,
    name: form.name,
    description: emptyToNull(form.description),
    tracking_slug: emptyToNull(form.tracking_slug),
    terms: emptyToNull(form.terms),
    start_at: localDateTimeToIso(form.start_at),
    end_at: localDateTimeToIso(form.end_at),
    daily_cap: emptyToNumber(form.daily_cap),
    monthly_cap: emptyToNumber(form.monthly_cap),
    overall_cap: emptyToNumber(form.overall_cap),
    event_definitions: form.event_definitions
      .map((eventDefinition) => ({
        event_code: eventDefinition.event_code.trim(),
        event_name: eventDefinition.event_name.trim(),
        advertiser_payout: eventDefinition.advertiser_payout.trim()
      }))
      .filter(
        (eventDefinition) =>
          eventDefinition.event_code.length > 0 ||
          eventDefinition.event_name.length > 0 ||
          eventDefinition.advertiser_payout.length > 0
      )
  };
}

function toUpdatePayload(form: OfferFormState): UpdateOfferRequest {
  return toCreatePayload(form);
}

function toFormState(offer: Offer): OfferFormState {
  return {
    advertiser_id: offer.advertiser.id,
    name: offer.name,
    description: offer.description ?? '',
    tracking_slug: offer.tracking_slug ?? '',
    terms: offer.terms ?? '',
    start_at: isoToLocalDateTime(offer.start_at),
    end_at: isoToLocalDateTime(offer.end_at),
    daily_cap: offer.daily_cap?.toString() ?? '',
    monthly_cap: offer.monthly_cap?.toString() ?? '',
    overall_cap: offer.overall_cap?.toString() ?? '',
    event_definitions:
      offer.event_definitions.length > 0
        ? offer.event_definitions.map(toEventFormState)
        : [{ ...EMPTY_EVENT }]
  };
}

function toEventFormState(eventDefinition: OfferEventDefinition): OfferEventDefinitionFormState {
  return {
    event_code: eventDefinition.event_code,
    event_name: eventDefinition.event_name,
    advertiser_payout: eventDefinition.advertiser_payout
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function emptyToNumber(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : Number(trimmed);
}

function localDateTimeToIso(value: string) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function isoToLocalDateTime(value: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 16);
}
