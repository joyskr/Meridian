'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  CurrentOrganizationResponse,
  CreatePublisherRequest,
  ListPublishersResponse,
  Publisher,
  PublisherDetailResponse,
  PublisherTierSettingsResponse,
  UpdatePublisherRequest
} from '@meridian/contracts';
import { apiFetch, getErrorMessage } from '../../lib/api';

type SessionResponse = {
  user: {
    email: string;
  };
};

type PublisherFormState = {
  name: string;
  website_url: string;
  primary_contact_name: string;
  primary_contact_email: string;
  notes: string;
  publisher_tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  publisher_postback_percent: string;
};

type TierSettingsFormState = {
  tier_1: string;
  tier_2: string;
  tier_3: string;
  tier_4: string;
};

const EMPTY_FORM: PublisherFormState = {
  name: '',
  website_url: '',
  primary_contact_name: '',
  primary_contact_email: '',
  notes: '',
  publisher_tier: 'tier_1',
  publisher_postback_percent: '100'
};

const EMPTY_TIER_SETTINGS: TierSettingsFormState = {
  tier_1: '40',
  tier_2: '55',
  tier_3: '70',
  tier_4: '80'
};

const STATUS_OPTIONS: Array<'active' | 'archived' | 'all'> = ['active', 'archived', 'all'];

export function PublishersClient() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<CurrentOrganizationResponse | null>(null);
  const [publishers, setPublishers] = useState<ListPublishersResponse['publishers']>([]);
  const [selectedPublisher, setSelectedPublisher] = useState<PublisherDetailResponse | null>(null);
  const [tierSettings, setTierSettings] = useState<TierSettingsFormState>(EMPTY_TIER_SETTINGS);
  const [createForm, setCreateForm] = useState<PublisherFormState>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<PublisherFormState>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPublisherState();
  }, []);

  async function loadPublisherState(
    nextStatusFilter: 'active' | 'archived' | 'all' = statusFilter,
    selectedPublisherId?: string
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
        setPublishers([]);
        setTierSettings(EMPTY_TIER_SETTINGS);
        setSelectedPublisher(null);
        return;
      }

      const membershipRole = currentResponse.membership?.role ?? null;
      const [publishersResponse, tierSettingsResponse] = await Promise.all([
        apiFetch<ListPublishersResponse>(`/publishers?status=${encodeURIComponent(nextStatusFilter)}`),
        membershipRole === 'owner' || membershipRole === 'admin'
          ? apiFetch<PublisherTierSettingsResponse>('/publisher-tier-settings')
          : Promise.resolve(null)
      ]);
      setPublishers(publishersResponse.publishers);
      if (tierSettingsResponse) {
        setTierSettings({
          tier_1: tierSettingsResponse.tier_settings.tier_1.toString(),
          tier_2: tierSettingsResponse.tier_settings.tier_2.toString(),
          tier_3: tierSettingsResponse.tier_settings.tier_3.toString(),
          tier_4: tierSettingsResponse.tier_settings.tier_4.toString()
        });
      }

      const nextSelectedPublisherId =
        selectedPublisherId ?? selectedPublisher?.publisher.id ?? publishersResponse.publishers[0]?.id;

      if (nextSelectedPublisherId) {
        const detailResponse = await apiFetch<PublisherDetailResponse>(
          `/publishers/${nextSelectedPublisherId}`
        );
        setSelectedPublisher(detailResponse);
        setEditForm(toFormState(detailResponse.publisher));
      } else {
        setSelectedPublisher(null);
        setEditForm(EMPTY_FORM);
      }
    } catch (requestError) {
      setSessionEmail(null);
      setCurrentOrganization(null);
      setPublishers([]);
      setTierSettings(EMPTY_TIER_SETTINGS);
      setSelectedPublisher(null);
      setEditForm(EMPTY_FORM);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPublisher(publisherId: string) {
    setSubmitting(true);
    setError(null);

    try {
      const detailResponse = await apiFetch<PublisherDetailResponse>(`/publishers/${publisherId}`);
      setSelectedPublisher(detailResponse);
      setEditForm(toFormState(detailResponse.publisher));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePublisher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<PublisherDetailResponse>('/publishers', {
        method: 'POST',
        body: JSON.stringify(toRequestPayload(createForm, canManagePublisherControls))
      });

      setCreateForm(EMPTY_FORM);
      await loadPublisherState(statusFilter, response.publisher.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdatePublisher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPublisher) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<PublisherDetailResponse>(
        `/publishers/${selectedPublisher.publisher.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(toRequestPayload(editForm, canManagePublisherControls))
        }
      );

      setSelectedPublisher(response);
      setEditForm(toFormState(response.publisher));
      await loadPublisherState(statusFilter, response.publisher.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveToggle() {
    if (!selectedPublisher) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const path =
        selectedPublisher.publisher.status === 'archived'
          ? `/publishers/${selectedPublisher.publisher.id}/restore`
          : `/publishers/${selectedPublisher.publisher.id}/archive`;

      const response = await apiFetch<PublisherDetailResponse>(path, {
        method: 'POST'
      });

      setSelectedPublisher(response);
      setEditForm(toFormState(response.publisher));
      await loadPublisherState(statusFilter, response.publisher.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateTierSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch<PublisherTierSettingsResponse>('/publisher-tier-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          tier_1: Number(tierSettings.tier_1),
          tier_2: Number(tierSettings.tier_2),
          tier_3: Number(tierSettings.tier_3),
          tier_4: Number(tierSettings.tier_4)
        })
      });

      setTierSettings({
        tier_1: response.tier_settings.tier_1.toString(),
        tier_2: response.tier_settings.tier_2.toString(),
        tier_3: response.tier_settings.tier_3.toString(),
        tier_4: response.tier_settings.tier_4.toString()
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const currentRole = currentOrganization?.membership?.role ?? null;
  const canManagePublishers =
    currentRole === 'owner' || currentRole === 'admin' || currentRole === 'manager';
  const canManagePublisherControls = currentRole === 'owner' || currentRole === 'admin';

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Phase 3.1</p>
          <h1 className="hero__title">Publisher records.</h1>
          <p className="hero__copy">
            Publishers are tenant-scoped master records managed through the Node API. The frontend
            only presents list, create, edit, archive, and restore flows against the approved
            publisher contract.
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
                    Publisher writes: {canManagePublishers ? 'manager+' : 'read-only'}
                  </p>
                </>
              ) : null}
              {!loading && !currentOrganization?.organization ? (
                <p className="panel__muted">Select or create an organization before managing publishers.</p>
              ) : null}
            </article>
          </div>

          <div className="panel-grid">
            <article className="panel">
              <h2>Publishers</h2>
              <label className="form-field">
                <span>Status filter</span>
                <select
                  className="text-input"
                  value={statusFilter}
                  disabled={loading || submitting}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    void loadPublisherState(event.target.value as 'active' | 'archived' | 'all')
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {loading ? <p>Loading publishers...</p> : null}
              {!loading && publishers.length === 0 ? (
                <p className="panel__muted">No publishers match the current filter.</p>
              ) : null}
              {!loading && publishers.length > 0 ? (
                <div className="organization-list">
                  {publishers.map((publisher) => (
                    <button
                      className="organization-item organization-item--button"
                      key={publisher.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSelectPublisher(publisher.id)}
                    >
                      <div>
                        <strong>{publisher.name}</strong>
                        <p className="panel__muted">
                          Status: {publisher.status}
                          {publisher.primary_contact_email ? ` | ${publisher.primary_contact_email}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="panel">
              <h2>Create Publisher</h2>
              {!canManagePublishers ? (
                <p className="panel__muted">Publisher creation is available only to manager, admin, or owner roles.</p>
              ) : (
                <form className="form-stack" onSubmit={(event) => void handleCreatePublisher(event)}>
                  <PublisherFormFields
                    form={createForm}
                    disabled={submitting}
                    canManagePublisherControls={canManagePublisherControls}
                    onChange={setCreateForm}
                  />
                  <div className="form-actions">
                    <button className="button button--primary" type="submit" disabled={submitting}>
                      {submitting ? 'Saving...' : 'Create publisher'}
                    </button>
                  </div>
                </form>
              )}
            </article>
          </div>

          {canManagePublisherControls ? (
            <article className="panel">
              <h2>Tier Settings</h2>
              <form className="form-stack" onSubmit={(event) => void handleUpdateTierSettings(event)}>
                <div className="panel-grid">
                  {(['tier_1', 'tier_2', 'tier_3', 'tier_4'] as const).map((tierKey) => (
                    <label className="form-field" key={tierKey}>
                      <span>{tierKey}</span>
                      <input
                        className="text-input"
                        type="number"
                        min="0"
                        max="100"
                        value={tierSettings[tierKey]}
                        disabled={submitting}
                        onChange={(event) =>
                          setTierSettings((previous) => ({
                            ...previous,
                            [tierKey]: event.target.value
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="form-actions">
                  <button className="button button--primary" type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Update tier settings'}
                  </button>
                </div>
              </form>
            </article>
          ) : null}

          <article className="panel">
            <h2>Selected Publisher</h2>
            {loading ? <p>Loading publisher...</p> : null}
            {!loading && !selectedPublisher ? (
              <p className="panel__muted">Select a publisher to inspect or edit it.</p>
            ) : null}
            {!loading && selectedPublisher ? (
              <div className="form-stack">
                <div className="detail-list">
                  <p>
                    <strong>Name:</strong> {selectedPublisher.publisher.name}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedPublisher.publisher.status}
                  </p>
                  <p>
                    <strong>Website:</strong> {selectedPublisher.publisher.website_url ?? 'Not set'}
                  </p>
                </div>

                {canManagePublishers ? (
                  <>
                    <form className="form-stack" onSubmit={(event) => void handleUpdatePublisher(event)}>
                      <PublisherFormFields
                        form={editForm}
                        disabled={submitting}
                        canManagePublisherControls={canManagePublisherControls}
                        onChange={setEditForm}
                      />
                      <div className="form-actions">
                        <button className="button button--primary" type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Update publisher'}
                        </button>
                        <button
                          className={
                            selectedPublisher.publisher.status === 'archived'
                              ? 'button button--primary'
                              : 'button button--danger'
                          }
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleArchiveToggle()}
                        >
                          {submitting
                            ? 'Saving...'
                            : selectedPublisher.publisher.status === 'archived'
                              ? 'Restore publisher'
                              : 'Archive publisher'}
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <p className="panel__muted">
                    This role can view publishers but cannot create, update, archive, or restore them.
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

function PublisherFormFields({
  form,
  disabled,
  canManagePublisherControls,
  onChange
}: {
  form: PublisherFormState;
  disabled: boolean;
  canManagePublisherControls: boolean;
  onChange: (next: PublisherFormState) => void;
}) {
  function updateField<Key extends keyof PublisherFormState>(key: Key, value: PublisherFormState[Key]) {
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
          placeholder="https://publisher.example"
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
          placeholder="publisher@example.com"
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
      {canManagePublisherControls ? (
        <div className="panel-grid">
          <label className="form-field">
            <span>Publisher tier</span>
            <select
              className="text-input"
              value={form.publisher_tier}
              disabled={disabled}
              onChange={(event) =>
                updateField('publisher_tier', event.target.value as PublisherFormState['publisher_tier'])
              }
            >
              <option value="tier_1">tier_1</option>
              <option value="tier_2">tier_2</option>
              <option value="tier_3">tier_3</option>
              <option value="tier_4">tier_4</option>
            </select>
          </label>
          <label className="form-field">
            <span>Publisher postback percent</span>
            <input
              className="text-input"
              type="number"
              min="0"
              max="100"
              value={form.publisher_postback_percent}
              disabled={disabled}
              onChange={(event) => updateField('publisher_postback_percent', event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </>
  );
}

function toRequestPayload(
  form: PublisherFormState,
  includeControls: boolean
): CreatePublisherRequest | UpdatePublisherRequest {
  const payload: CreatePublisherRequest | UpdatePublisherRequest = {
    name: form.name,
    website_url: emptyToNull(form.website_url),
    primary_contact_name: emptyToNull(form.primary_contact_name),
    primary_contact_email: emptyToNull(form.primary_contact_email),
    notes: emptyToNull(form.notes)
  };

  if (includeControls) {
    payload.publisher_tier = form.publisher_tier;
    payload.publisher_postback_percent = emptyToNumber(form.publisher_postback_percent);
  }

  return payload;
}

function toFormState(publisher: Publisher): PublisherFormState {
  return {
    name: publisher.name,
    website_url: publisher.website_url ?? '',
    primary_contact_name: publisher.primary_contact_name ?? '',
    primary_contact_email: publisher.primary_contact_email ?? '',
    notes: publisher.notes ?? '',
    publisher_tier: publisher.publisher_tier,
    publisher_postback_percent: publisher.publisher_postback_percent.toString()
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
