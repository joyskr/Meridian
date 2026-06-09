'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  Advertiser,
  AdvertiserDetailResponse,
  CreateAdvertiserRequest,
  CurrentOrganizationResponse,
  ListAdvertisersResponse,
  UpdateAdvertiserRequest
} from '@meridian/contracts';
import { apiFetch, getErrorMessage } from '../../lib/api';

type SessionResponse = {
  user: {
    email: string;
  };
};

type AdvertiserFormState = {
  name: string;
  website_url: string;
  primary_contact_name: string;
  primary_contact_email: string;
  notes: string;
};

const EMPTY_FORM: AdvertiserFormState = {
  name: '',
  website_url: '',
  primary_contact_name: '',
  primary_contact_email: '',
  notes: ''
};

const STATUS_OPTIONS: Array<'active' | 'archived' | 'all'> = ['active', 'archived', 'all'];

export function AdvertisersClient() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<CurrentOrganizationResponse | null>(null);
  const [advertisers, setAdvertisers] = useState<ListAdvertisersResponse['advertisers']>([]);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<AdvertiserDetailResponse | null>(null);
  const [createForm, setCreateForm] = useState<AdvertiserFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<AdvertiserFormState>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAdvertiserState();
  }, []);

  async function loadAdvertiserState(
    nextStatusFilter: 'active' | 'archived' | 'all' = statusFilter,
    selectedAdvertiserId?: string
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
        setSelectedAdvertiser(null);
        return;
      }

      const advertisersResponse = await apiFetch<ListAdvertisersResponse>(
        `/advertisers?status=${encodeURIComponent(nextStatusFilter)}`
      );
      setAdvertisers(advertisersResponse.advertisers);

      const nextSelectedAdvertiserId =
        selectedAdvertiserId ??
        selectedAdvertiser?.advertiser.id ??
        advertisersResponse.advertisers[0]?.id;

      if (nextSelectedAdvertiserId) {
        const detailResponse = await apiFetch<AdvertiserDetailResponse>(
          `/advertisers/${nextSelectedAdvertiserId}`
        );
        setSelectedAdvertiser(detailResponse);
        setEditForm(toFormState(detailResponse.advertiser));
      } else {
        setSelectedAdvertiser(null);
        setEditForm(EMPTY_FORM);
      }
    } catch (requestError) {
      setSessionEmail(null);
      setCurrentOrganization(null);
      setAdvertisers([]);
      setSelectedAdvertiser(null);
      setEditForm(EMPTY_FORM);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectAdvertiser(advertiserId: string) {
    setSubmitting(true);
    setError(null);

    try {
      const detailResponse = await apiFetch<AdvertiserDetailResponse>(
        `/advertisers/${advertiserId}`
      );
      setSelectedAdvertiser(detailResponse);
      setEditForm(toFormState(detailResponse.advertiser));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateAdvertiser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<AdvertiserDetailResponse>('/advertisers', {
        method: 'POST',
        body: JSON.stringify(toRequestPayload(createForm))
      });

      setCreateForm(EMPTY_FORM);
      await loadAdvertiserState(statusFilter, response.advertiser.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateAdvertiser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAdvertiser) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<AdvertiserDetailResponse>(
        `/advertisers/${selectedAdvertiser.advertiser.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(toRequestPayload(editForm))
        }
      );

      setSelectedAdvertiser(response);
      setEditForm(toFormState(response.advertiser));
      await loadAdvertiserState(statusFilter, response.advertiser.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveToggle() {
    if (!selectedAdvertiser) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const path =
        selectedAdvertiser.advertiser.status === 'archived'
          ? `/advertisers/${selectedAdvertiser.advertiser.id}/restore`
          : `/advertisers/${selectedAdvertiser.advertiser.id}/archive`;

      const response = await apiFetch<AdvertiserDetailResponse>(path, {
        method: 'POST'
      });

      setSelectedAdvertiser(response);
      setEditForm(toFormState(response.advertiser));
      await loadAdvertiserState(statusFilter, response.advertiser.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const currentRole = currentOrganization?.membership?.role ?? null;
  const canManageAdvertisers =
    currentRole === 'owner' || currentRole === 'admin' || currentRole === 'manager';

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Phase 3.2</p>
          <h1 className="hero__title">Advertiser records.</h1>
          <p className="hero__copy">
            Advertisers are tenant-scoped master records managed through the Node API. The
            frontend presents list, create, edit, archive, and restore flows against the approved
            advertiser contract without moving business logic into Next.js.
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
                    Advertiser writes: {canManageAdvertisers ? 'manager+' : 'read-only'}
                  </p>
                </>
              ) : null}
              {!loading && !currentOrganization?.organization ? (
                <p className="panel__muted">Select or create an organization before managing advertisers.</p>
              ) : null}
            </article>
          </div>

          <div className="panel-grid">
            <article className="panel">
              <h2>Advertisers</h2>
              <label className="form-field">
                <span>Status filter</span>
                <select
                  className="text-input"
                  value={statusFilter}
                  disabled={loading || submitting}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    void loadAdvertiserState(event.target.value as 'active' | 'archived' | 'all')
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {loading ? <p>Loading advertisers...</p> : null}
              {!loading && advertisers.length === 0 ? (
                <p className="panel__muted">No advertisers match the current filter.</p>
              ) : null}
              {!loading && advertisers.length > 0 ? (
                <div className="organization-list">
                  {advertisers.map((advertiser) => (
                    <button
                      className="organization-item organization-item--button"
                      key={advertiser.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSelectAdvertiser(advertiser.id)}
                    >
                      <div>
                        <strong>{advertiser.name}</strong>
                        <p className="panel__muted">
                          Status: {advertiser.status}
                          {advertiser.primary_contact_email ? ` | ${advertiser.primary_contact_email}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="panel">
              <h2>Create Advertiser</h2>
              {!canManageAdvertisers ? (
                <p className="panel__muted">
                  Advertiser creation is available only to manager, admin, or owner roles.
                </p>
              ) : (
                <form className="form-stack" onSubmit={(event) => void handleCreateAdvertiser(event)}>
                  <AdvertiserFormFields
                    form={createForm}
                    disabled={submitting}
                    onChange={setCreateForm}
                  />
                  <div className="form-actions">
                    <button className="button button--primary" type="submit" disabled={submitting}>
                      {submitting ? 'Saving...' : 'Create advertiser'}
                    </button>
                  </div>
                </form>
              )}
            </article>
          </div>

          <article className="panel">
            <h2>Selected Advertiser</h2>
            {loading ? <p>Loading advertiser...</p> : null}
            {!loading && !selectedAdvertiser ? (
              <p className="panel__muted">Select an advertiser to inspect or edit it.</p>
            ) : null}
            {!loading && selectedAdvertiser ? (
              <div className="form-stack">
                <div className="detail-list">
                  <p>
                    <strong>Name:</strong> {selectedAdvertiser.advertiser.name}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedAdvertiser.advertiser.status}
                  </p>
                  <p>
                    <strong>Website:</strong> {selectedAdvertiser.advertiser.website_url ?? 'Not set'}
                  </p>
                </div>

                {canManageAdvertisers ? (
                  <form className="form-stack" onSubmit={(event) => void handleUpdateAdvertiser(event)}>
                    <AdvertiserFormFields form={editForm} disabled={submitting} onChange={setEditForm} />
                    <div className="form-actions">
                      <button className="button button--primary" type="submit" disabled={submitting}>
                        {submitting ? 'Saving...' : 'Update advertiser'}
                      </button>
                      <button
                        className={
                          selectedAdvertiser.advertiser.status === 'archived'
                            ? 'button button--primary'
                            : 'button button--danger'
                        }
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleArchiveToggle()}
                      >
                        {submitting
                          ? 'Saving...'
                          : selectedAdvertiser.advertiser.status === 'archived'
                            ? 'Restore advertiser'
                            : 'Archive advertiser'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="panel__muted">
                    This role can view advertisers but cannot create, update, archive, or restore them.
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

function AdvertiserFormFields({
  form,
  disabled,
  onChange
}: {
  form: AdvertiserFormState;
  disabled: boolean;
  onChange: (next: AdvertiserFormState) => void;
}) {
  function updateField<Key extends keyof AdvertiserFormState>(key: Key, value: AdvertiserFormState[Key]) {
    onChange({
      ...form,
      [key]: value
    });
  }

  return (
    <>
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
        <span>Website URL</span>
        <input
          className="text-input"
          value={form.website_url}
          disabled={disabled}
          onChange={(event) => updateField('website_url', event.target.value)}
          placeholder="https://advertiser.example"
        />
      </label>
      <label className="form-field">
        <span>Primary contact name</span>
        <input
          className="text-input"
          value={form.primary_contact_name}
          disabled={disabled}
          onChange={(event) => updateField('primary_contact_name', event.target.value)}
        />
      </label>
      <label className="form-field">
        <span>Primary contact email</span>
        <input
          className="text-input"
          value={form.primary_contact_email}
          disabled={disabled}
          onChange={(event) => updateField('primary_contact_email', event.target.value)}
          placeholder="advertiser@example.com"
        />
      </label>
      <label className="form-field">
        <span>Notes</span>
        <textarea
          className="text-input text-area"
          value={form.notes}
          disabled={disabled}
          onChange={(event) => updateField('notes', event.target.value)}
          rows={4}
        />
      </label>
    </>
  );
}

function toRequestPayload(form: AdvertiserFormState): CreateAdvertiserRequest | UpdateAdvertiserRequest {
  return {
    name: form.name,
    website_url: emptyToNull(form.website_url),
    primary_contact_name: emptyToNull(form.primary_contact_name),
    primary_contact_email: emptyToNull(form.primary_contact_email),
    notes: emptyToNull(form.notes)
  };
}

function toFormState(advertiser: Advertiser): AdvertiserFormState {
  return {
    name: advertiser.name,
    website_url: advertiser.website_url ?? '',
    primary_contact_name: advertiser.primary_contact_name ?? '',
    primary_contact_email: advertiser.primary_contact_email ?? '',
    notes: advertiser.notes ?? ''
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
