'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  CurrentOrganizationResponse,
  ListOfferAssignmentsResponse,
  ListOffersResponse,
  ListPublishersResponse,
  OfferAssignment,
  OfferAssignmentDetailResponse,
  OfferAssignmentTrackingLinkResponse
} from '@meridian/contracts';
import { apiFetch, getErrorMessage } from '../../lib/api';

type SessionResponse = {
  user: {
    email: string;
  };
};

type AssignmentOverrideFormState = {
  event_code: string;
  publisher_payout_amount: string;
};

type AssignmentFormState = {
  offer_id: string;
  publisher_id: string;
  redirect_url: string;
  conversion_visibility_percent: string;
  postback_percent: string;
  payout_overrides: AssignmentOverrideFormState[];
};

const EMPTY_OVERRIDE: AssignmentOverrideFormState = {
  event_code: '',
  publisher_payout_amount: ''
};

const EMPTY_FORM: AssignmentFormState = {
  offer_id: '',
  publisher_id: '',
  redirect_url: '',
  conversion_visibility_percent: '100',
  postback_percent: '100',
  payout_overrides: [{ ...EMPTY_OVERRIDE }]
};

const STATUS_OPTIONS: Array<'active' | 'paused' | 'archived' | 'all'> = ['all', 'active', 'paused', 'archived'];

export function OfferAssignmentsClient() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<CurrentOrganizationResponse | null>(null);
  const [offers, setOffers] = useState<ListOffersResponse['offers']>([]);
  const [publishers, setPublishers] = useState<ListPublishersResponse['publishers']>([]);
  const [assignments, setAssignments] = useState<ListOfferAssignmentsResponse['assignments']>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<OfferAssignmentDetailResponse | null>(null);
  const [trackingLink, setTrackingLink] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<AssignmentFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<AssignmentFormState>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'archived' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadState();
  }, []);

  async function loadState(
    nextStatusFilter: 'active' | 'paused' | 'archived' | 'all' = statusFilter,
    selectedAssignmentId?: string
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
        setOffers([]);
        setPublishers([]);
        setAssignments([]);
        setSelectedAssignment(null);
        setTrackingLink(null);
        return;
      }

      const [offersResponse, publishersResponse, assignmentsResponse] = await Promise.all([
        apiFetch<ListOffersResponse>('/offers?status=all'),
        apiFetch<ListPublishersResponse>('/publishers?status=active'),
        apiFetch<ListOfferAssignmentsResponse>(`/offer-assignments?status=${encodeURIComponent(nextStatusFilter)}`)
      ]);

      setOffers(offersResponse.offers);
      setPublishers(publishersResponse.publishers);
      setAssignments(assignmentsResponse.assignments);
      setCreateForm((previous) => ({
        ...previous,
        offer_id: previous.offer_id || offersResponse.offers[0]?.id || '',
        publisher_id: previous.publisher_id || publishersResponse.publishers[0]?.id || ''
      }));

      const nextSelectedAssignmentId =
        selectedAssignmentId ?? selectedAssignment?.assignment.id ?? assignmentsResponse.assignments[0]?.id;

      if (nextSelectedAssignmentId) {
        await loadAssignmentDetail(nextSelectedAssignmentId);
      } else {
        setSelectedAssignment(null);
        setTrackingLink(null);
        setEditForm(EMPTY_FORM);
      }
    } catch (requestError) {
      setSessionEmail(null);
      setCurrentOrganization(null);
      setOffers([]);
      setPublishers([]);
      setAssignments([]);
      setSelectedAssignment(null);
      setTrackingLink(null);
      setEditForm(EMPTY_FORM);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignmentDetail(assignmentId: string) {
    const [detailResponse, trackingLinkResponse] = await Promise.all([
      apiFetch<OfferAssignmentDetailResponse>(`/offer-assignments/${assignmentId}`),
      apiFetch<OfferAssignmentTrackingLinkResponse>(`/offer-assignments/${assignmentId}/tracking-link`)
    ]);

    setSelectedAssignment(detailResponse);
    setTrackingLink(trackingLinkResponse.tracking_link.tracking_path);
    setEditForm(toAssignmentForm(detailResponse.assignment));
  }

  async function handleSelectAssignment(assignmentId: string) {
    setSubmitting(true);
    setError(null);

    try {
      await loadAssignmentDetail(assignmentId);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<OfferAssignmentDetailResponse>('/offer-assignments', {
        method: 'POST',
        body: JSON.stringify(toAssignmentPayload(createForm, true))
      });

      setCreateForm({
        ...EMPTY_FORM,
        offer_id: createForm.offer_id || offers[0]?.id || '',
        publisher_id: createForm.publisher_id || publishers[0]?.id || ''
      });
      await loadState(statusFilter, response.assignment.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssignment) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<OfferAssignmentDetailResponse>(
        `/offer-assignments/${selectedAssignment.assignment.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(toAssignmentPayload(editForm, false))
        }
      );

      setSelectedAssignment(response);
      setEditForm(toAssignmentForm(response.assignment));
      await loadState(statusFilter, response.assignment.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLifecycleAction(path: string) {
    if (!selectedAssignment) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<OfferAssignmentDetailResponse>(path, {
        method: 'POST'
      });

      setSelectedAssignment(response);
      setEditForm(toAssignmentForm(response.assignment));
      await loadState(statusFilter, response.assignment.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const currentRole = currentOrganization?.membership?.role ?? null;
  const canManageAssignments =
    currentRole === 'owner' || currentRole === 'admin' || currentRole === 'manager';

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Phase 4.2</p>
          <h1 className="hero__title">Offer assignments and publisher controls.</h1>
          <p className="hero__copy">
            Assignments are the sole public-tracking authority. Publisher tier, postback, and fixed
            payout overrides stay in the Node API and are applied deterministically.
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
                    Assignment writes: {canManageAssignments ? 'manager+' : 'read-only'}
                  </p>
                </>
              ) : null}
            </article>
          </div>

          <div className="panel-grid">
            <article className="panel">
              <h2>Assignments</h2>
              <label className="form-field">
                <span>Status filter</span>
                <select
                  className="text-input"
                  value={statusFilter}
                  disabled={loading || submitting}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    void loadState(event.target.value as 'active' | 'paused' | 'archived' | 'all')
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {loading ? <p>Loading assignments...</p> : null}
              {!loading && assignments.length === 0 ? (
                <p className="panel__muted">No assignments match the current filter.</p>
              ) : null}
              {!loading && assignments.length > 0 ? (
                <div className="organization-list">
                  {assignments.map((assignment) => (
                    <button
                      className="organization-item organization-item--button"
                      key={assignment.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSelectAssignment(assignment.id)}
                    >
                      <div>
                        <strong>{assignment.offer.name}</strong>
                        <p className="panel__muted">
                          {assignment.publisher.name} | {assignment.status} | effective postback {assignment.effective_postback_percent}%
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="panel">
              <h2>Create Assignment</h2>
              {!canManageAssignments ? (
                <p className="panel__muted">Assignment creation is available only to manager, admin, or owner roles.</p>
              ) : offers.length === 0 || publishers.length === 0 ? (
                <p className="panel__muted">Create at least one offer and one active publisher first.</p>
              ) : (
                <form className="form-stack" onSubmit={(event) => void handleCreateAssignment(event)}>
                  <AssignmentFormFields
                    form={createForm}
                    disabled={submitting}
                    offers={offers}
                    publishers={publishers}
                    lockPair={false}
                    onChange={setCreateForm}
                  />
                  <div className="form-actions">
                    <button className="button button--primary" type="submit" disabled={submitting}>
                      {submitting ? 'Saving...' : 'Create assignment'}
                    </button>
                  </div>
                </form>
              )}
            </article>
          </div>

          <article className="panel">
            <h2>Selected Assignment</h2>
            {loading ? <p>Loading assignment...</p> : null}
            {!loading && !selectedAssignment ? (
              <p className="panel__muted">Select an assignment to inspect or manage it.</p>
            ) : null}
            {!loading && selectedAssignment ? (
              <div className="form-stack">
                <div className="detail-list">
                  <p><strong>Offer:</strong> {selectedAssignment.assignment.offer.name}</p>
                  <p><strong>Publisher:</strong> {selectedAssignment.assignment.publisher.name}</p>
                  <p><strong>Status:</strong> {selectedAssignment.assignment.status}</p>
                  <p><strong>Tracking path:</strong> {trackingLink ?? selectedAssignment.assignment.tracking_link.tracking_path}</p>
                  <p><strong>Redirect URL:</strong> {selectedAssignment.assignment.redirect_url}</p>
                  <p><strong>Effective postback:</strong> {selectedAssignment.assignment.effective_postback_percent}%</p>
                </div>

                {canManageAssignments ? (
                  <>
                    <form className="form-stack" onSubmit={(event) => void handleUpdateAssignment(event)}>
                      <AssignmentFormFields
                        form={editForm}
                        disabled={submitting || selectedAssignment.assignment.status === 'archived'}
                        offers={offers}
                        publishers={publishers}
                        lockPair
                        onChange={setEditForm}
                      />
                      <div className="form-actions">
                        <button
                          className="button button--primary"
                          type="submit"
                          disabled={submitting || selectedAssignment.assignment.status === 'archived'}
                        >
                          {submitting ? 'Saving...' : 'Update assignment'}
                        </button>
                      </div>
                    </form>

                    <div className="form-actions">
                      {selectedAssignment.assignment.status === 'active' ? (
                        <button
                          className="button"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offer-assignments/${selectedAssignment.assignment.id}/pause`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Pause assignment'}
                        </button>
                      ) : null}

                      {selectedAssignment.assignment.status === 'paused' ? (
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offer-assignments/${selectedAssignment.assignment.id}/resume`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Resume assignment'}
                        </button>
                      ) : null}

                      {selectedAssignment.assignment.status === 'archived' ? (
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offer-assignments/${selectedAssignment.assignment.id}/restore`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Restore assignment'}
                        </button>
                      ) : (
                        <button
                          className="button button--danger"
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            void handleLifecycleAction(`/offer-assignments/${selectedAssignment.assignment.id}/archive`)
                          }
                        >
                          {submitting ? 'Saving...' : 'Archive assignment'}
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </article>

          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

function AssignmentFormFields({
  form,
  disabled,
  offers,
  publishers,
  lockPair,
  onChange
}: {
  form: AssignmentFormState;
  disabled: boolean;
  offers: ListOffersResponse['offers'];
  publishers: ListPublishersResponse['publishers'];
  lockPair: boolean;
  onChange: (next: AssignmentFormState) => void;
}) {
  function updateField<Key extends keyof AssignmentFormState>(key: Key, value: AssignmentFormState[Key]) {
    onChange({
      ...form,
      [key]: value
    });
  }

  function updateOverride(index: number, nextOverride: AssignmentOverrideFormState) {
    const nextOverrides = [...form.payout_overrides];
    nextOverrides[index] = nextOverride;
    updateField('payout_overrides', nextOverrides);
  }

  function addOverride() {
    updateField('payout_overrides', [...form.payout_overrides, { ...EMPTY_OVERRIDE }]);
  }

  function removeOverride(index: number) {
    if (form.payout_overrides.length === 1) {
      updateField('payout_overrides', [{ ...EMPTY_OVERRIDE }]);
      return;
    }

    updateField(
      'payout_overrides',
      form.payout_overrides.filter((_, overrideIndex) => overrideIndex !== index)
    );
  }

  return (
    <>
      <div className="panel-grid">
        <label className="form-field">
          <span>Offer</span>
          <select
            className="text-input"
            value={form.offer_id}
            disabled={disabled || lockPair}
            onChange={(event) => updateField('offer_id', event.target.value)}
            required
          >
            <option value="" disabled>Select offer</option>
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Publisher</span>
          <select
            className="text-input"
            value={form.publisher_id}
            disabled={disabled || lockPair}
            onChange={(event) => updateField('publisher_id', event.target.value)}
            required
          >
            <option value="" disabled>Select publisher</option>
            {publishers.map((publisher) => (
              <option key={publisher.id} value={publisher.id}>
                {publisher.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="form-field">
        <span>Redirect URL</span>
        <input
          className="text-input"
          type="url"
          value={form.redirect_url}
          disabled={disabled}
          onChange={(event) => updateField('redirect_url', event.target.value)}
          placeholder="https://publisher.example/landing"
          required
        />
      </label>

      <div className="panel-grid">
        <label className="form-field">
          <span>Conversion visibility %</span>
          <input
            className="text-input"
            type="number"
            min="0"
            max="100"
            value={form.conversion_visibility_percent}
            disabled={disabled}
            onChange={(event) => updateField('conversion_visibility_percent', event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Assignment postback %</span>
          <input
            className="text-input"
            type="number"
            min="0"
            max="100"
            value={form.postback_percent}
            disabled={disabled}
            onChange={(event) => updateField('postback_percent', event.target.value)}
          />
        </label>
      </div>

      <div className="form-stack">
        <div className="detail-list">
          <p><strong>Event-scoped fixed payout overrides</strong></p>
          <p className="panel__muted">Overrides are fixed amounts only. Percentage overrides are excluded from MVP.</p>
        </div>
        {form.payout_overrides.map((override, index) => (
          <div className="panel" key={`${override.event_code}-${index}`}>
            <div className="panel-grid">
              <label className="form-field">
                <span>Event code</span>
                <input
                  className="text-input"
                  value={override.event_code}
                  disabled={disabled}
                  onChange={(event) =>
                    updateOverride(index, {
                      ...override,
                      event_code: event.target.value
                    })
                  }
                  placeholder="sale"
                />
              </label>
              <label className="form-field">
                <span>Publisher payout override</span>
                <input
                  className="text-input"
                  value={override.publisher_payout_amount}
                  disabled={disabled}
                  onChange={(event) =>
                    updateOverride(index, {
                      ...override,
                      publisher_payout_amount: event.target.value
                    })
                  }
                  placeholder="8.50"
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="button button--danger" type="button" disabled={disabled} onClick={() => removeOverride(index)}>
                Remove override
              </button>
            </div>
          </div>
        ))}
        <div className="form-actions">
          <button className="button" type="button" disabled={disabled} onClick={addOverride}>
            Add override
          </button>
        </div>
      </div>
    </>
  );
}

function toAssignmentPayload(form: AssignmentFormState, includePair: boolean) {
  return {
    ...(includePair
      ? {
          offer_id: form.offer_id,
          publisher_id: form.publisher_id,
          redirect_url: form.redirect_url.trim()
        }
      : {}),
    ...(!includePair
      ? {
          redirect_url: form.redirect_url.trim()
        }
      : {}),
    conversion_visibility_percent: Number(form.conversion_visibility_percent),
    postback_percent: Number(form.postback_percent),
    payout_overrides: form.payout_overrides
      .map((override) => ({
        event_code: override.event_code.trim(),
        publisher_payout_amount: override.publisher_payout_amount.trim()
      }))
      .filter(
        (override) =>
          override.event_code.length > 0 || override.publisher_payout_amount.length > 0
      )
  };
}

function toAssignmentForm(assignment: OfferAssignment): AssignmentFormState {
  return {
    offer_id: assignment.offer.id,
    publisher_id: assignment.publisher.id,
    redirect_url: assignment.redirect_url,
    conversion_visibility_percent: assignment.conversion_visibility_percent.toString(),
    postback_percent: assignment.postback_percent.toString(),
    payout_overrides:
      assignment.payout_overrides.length > 0
        ? assignment.payout_overrides.map((override) => ({
            event_code: override.event_code,
            publisher_payout_amount: override.publisher_payout_amount
          }))
        : [{ ...EMPTY_OVERRIDE }]
  };
}
