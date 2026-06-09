'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import type {
  CurrentOrganizationResponse,
  ListMembershipsResponse,
  MembershipDetailResponse,
  MembershipRole,
  UpdateMembershipRoleResponse
} from '@meridian/contracts';
import { apiFetch, getErrorMessage } from '../../lib/api';

const ROLE_OPTIONS: MembershipRole[] = ['owner', 'admin', 'manager', 'analyst', 'viewer'];

type SessionResponse = {
  user: {
    email: string;
  };
};

export function TeamClient() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<CurrentOrganizationResponse | null>(null);
  const [memberships, setMemberships] = useState<ListMembershipsResponse['memberships']>([]);
  const [selectedMembership, setSelectedMembership] = useState<MembershipDetailResponse | null>(null);
  const [selectedRole, setSelectedRole] = useState<MembershipRole>('viewer');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTeamState();
  }, []);

  async function loadTeamState(selectedMembershipId?: string) {
    setLoading(true);
    setError(null);

    try {
      const [sessionResponse, currentResponse] = await Promise.all([
        apiFetch<SessionResponse>('/auth/session'),
        apiFetch<CurrentOrganizationResponse>('/organizations/current')
      ]);

      setSessionEmail(sessionResponse.user.email);
      setCurrentOrganization(currentResponse);

      if (!currentResponse.organization) {
        setMemberships([]);
        setSelectedMembership(null);
        return;
      }

      const currentRole = currentResponse.membership?.role ?? null;

      if (currentRole !== 'owner' && currentRole !== 'admin') {
        setMemberships([]);
        setSelectedMembership(null);
        return;
      }

      const membershipsResponse = await apiFetch<ListMembershipsResponse>('/memberships');
      setMemberships(membershipsResponse.memberships);

      const nextSelectedMembershipId =
        selectedMembershipId ??
        selectedMembership?.membership.id ??
        membershipsResponse.memberships[0]?.membership.id;

      if (nextSelectedMembershipId) {
        const membershipResponse = await apiFetch<MembershipDetailResponse>(
          `/memberships/${nextSelectedMembershipId}`
        );
        setSelectedMembership(membershipResponse);
        setSelectedRole(membershipResponse.membership.role);
      } else {
        setSelectedMembership(null);
      }
    } catch (requestError) {
      setSessionEmail(null);
      setCurrentOrganization(null);
      setMemberships([]);
      setSelectedMembership(null);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectMembership(membershipId: string) {
    setSubmitting(true);
    setError(null);

    try {
      const membershipResponse = await apiFetch<MembershipDetailResponse>(`/memberships/${membershipId}`);
      setSelectedMembership(membershipResponse);
      setSelectedRole(membershipResponse.membership.role);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleUpdate() {
    if (!selectedMembership) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updatedMembership = await apiFetch<UpdateMembershipRoleResponse>(
        `/memberships/${selectedMembership.membership.id}/role`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            role: selectedRole
          })
        }
      );

      setSelectedMembership(updatedMembership);
      await loadTeamState(updatedMembership.membership.id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivateMembership() {
    if (!selectedMembership) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiFetch(`/memberships/${selectedMembership.membership.id}/deactivate`, {
        method: 'PATCH'
      });

      await loadTeamState();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const currentRole = currentOrganization?.membership?.role ?? null;
  const canManageTeam = currentRole === 'owner' || currentRole === 'admin';

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <p className="hero__eyebrow">Phase 2.1</p>
          <h1 className="hero__title">Team management.</h1>
          <p className="hero__copy">
            Meridian keeps RBAC and team mutations inside the Node API. This page reads the current
            organization context and presents member management controls only when the API says the
            current role is administrative.
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
                    Team access: {canManageTeam ? 'owner/admin controls enabled' : 'read-only or unavailable'}
                  </p>
                </>
              ) : null}
              {!loading && !currentOrganization?.organization ? (
                <p className="panel__muted">Select or create an organization before managing memberships.</p>
              ) : null}
            </article>
          </div>

          <div className="panel-grid">
            <article className="panel">
              <h2>Members</h2>
              {loading ? <p>Loading memberships...</p> : null}
              {!loading && memberships.length === 0 ? (
                <p className="panel__muted">No memberships are available for the current organization.</p>
              ) : null}
              {!loading && memberships.length > 0 ? (
                <div className="organization-list">
                  {memberships.map((item) => (
                    <button
                      className="organization-item organization-item--button"
                      key={item.membership.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSelectMembership(item.membership.id)}
                    >
                      <div>
                        <strong>{item.user.email}</strong>
                        <p className="panel__muted">
                          Role: {item.membership.role}
                          {' | '}
                          Status: {item.membership.status}
                          {item.current ? ' | Current user' : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="panel">
              <h2>Selected Member</h2>
              {loading ? <p>Loading member...</p> : null}
              {!loading && !selectedMembership ? (
                <p className="panel__muted">Select a membership to inspect or change it.</p>
              ) : null}
              {!loading && selectedMembership ? (
                <div className="form-stack">
                  <div className="detail-list">
                    <p>
                      <strong>Email:</strong> {selectedMembership.user.email}
                    </p>
                    <p>
                      <strong>Role:</strong> {selectedMembership.membership.role}
                    </p>
                    <p>
                      <strong>Status:</strong> {selectedMembership.membership.status}
                    </p>
                  </div>

                  {canManageTeam ? (
                    <>
                      <label className="form-field">
                        <span>New role</span>
                        <select
                          className="text-input"
                          value={selectedRole}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                            setSelectedRole(event.target.value as MembershipRole)
                          }
                          disabled={submitting}
                        >
                          {ROLE_OPTIONS.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleOption}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="form-actions">
                        <button
                          className="button button--primary"
                          type="button"
                          disabled={submitting || selectedRole === selectedMembership.membership.role}
                          onClick={() => void handleRoleUpdate()}
                        >
                          {submitting ? 'Saving...' : 'Update role'}
                        </button>
                        <button
                          className="button button--danger"
                          type="button"
                          disabled={submitting || selectedMembership.membership.status === 'deactivated'}
                          onClick={() => void handleDeactivateMembership()}
                        >
                          {submitting ? 'Saving...' : 'Deactivate membership'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="panel__muted">
                      Team mutations are available only to owner or admin memberships.
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
