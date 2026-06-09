'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type {
  CurrentOrganizationResponse,
  CreateOrganizationResponse,
  ListOrganizationsResponse,
  SelectActiveOrganizationResponse
} from '@meridian/contracts';
import { apiFetch, getErrorMessage } from '../../lib/api';

type SessionResponse = {
  user: {
    email: string;
  };
};

export function OnboardingClient() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<CurrentOrganizationResponse | null>(null);
  const [organizations, setOrganizations] = useState<ListOrganizationsResponse['organizations']>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadOnboardingState();
  }, []);

  async function loadOnboardingState() {
    setLoading(true);
    setError(null);

    try {
      const sessionResponse = await apiFetch<SessionResponse>('/auth/session');
      const currentResponse = await apiFetch<CurrentOrganizationResponse>('/organizations/current');
      const organizationsResponse = await apiFetch<ListOrganizationsResponse>('/organizations');

      setSessionEmail(sessionResponse.user.email);
      setCurrentOrganization(currentResponse);
      setOrganizations(organizationsResponse.organizations);
    } catch (requestError) {
      setSessionEmail(null);
      setCurrentOrganization(null);
      setOrganizations([]);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch<CreateOrganizationResponse>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: organizationName
        })
      });

      setOrganizationName('');
      await loadOnboardingState();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectOrganization(organizationId: string) {
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch<SelectActiveOrganizationResponse>('/organizations/select-active', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId
        })
      });

      await loadOnboardingState();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Phase 1.2</p>
          <h1 className="hero__title">Organization onboarding.</h1>
          <p className="hero__copy">
            Meridian keeps onboarding in the Node API. This page only presents the current session,
            organization selection, and organization creation flow.
          </p>

          <div className="panel-grid">
            <article className="panel">
              <h2>Session</h2>
              {loading ? <p>Loading session...</p> : <p>{sessionEmail ?? 'No authenticated API session.'}</p>}
              <p className="panel__muted">
                Sign in through the API first, then return here to create or select an organization.
              </p>
            </article>

            <article className="panel">
              <h2>Current Organization</h2>
              {loading ? <p>Loading organization...</p> : null}
              {!loading && currentOrganization?.organization ? (
                <>
                  <p>{currentOrganization.organization.name}</p>
                  <p className="panel__muted">
                    Role: {currentOrganization.membership?.role ?? 'unknown'}
                  </p>
                </>
              ) : null}
              {!loading && !currentOrganization?.organization ? (
                <p className="panel__muted">No active organization selected for this session.</p>
              ) : null}
            </article>
          </div>

          <article className="panel">
            <h2>Create Organization</h2>
            <form className="form-stack" onSubmit={(event) => void handleCreateOrganization(event)}>
              <label className="form-field">
                <span>Name</span>
                <input
                  className="text-input"
                  name="name"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Meridian Agency"
                  disabled={submitting}
                />
              </label>
              <div className="form-actions">
                <button className="button button--primary" type="submit" disabled={submitting || !organizationName.trim()}>
                  {submitting ? 'Saving...' : 'Create organization'}
                </button>
              </div>
            </form>
          </article>

          <article className="panel">
            <h2>Your Organizations</h2>
            {loading ? <p>Loading organizations...</p> : null}
            {!loading && organizations.length === 0 ? (
              <p className="panel__muted">No organizations are available yet for this user.</p>
            ) : null}
            {!loading && organizations.length > 0 ? (
              <div className="organization-list">
                {organizations.map((item) => (
                  <div className="organization-item" key={item.organization.id}>
                    <div>
                      <strong>{item.organization.name}</strong>
                      <p className="panel__muted">
                        Role: {item.membership.role}
                        {' | '}
                        {item.current ? 'Current session organization' : 'Available to select'}
                      </p>
                    </div>
                    <button
                      className="button"
                      type="button"
                      disabled={submitting || item.current}
                      onClick={() => void handleSelectOrganization(item.organization.id)}
                    >
                      {item.current ? 'Selected' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </article>

          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
