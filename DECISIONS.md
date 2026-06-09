# Meridian Decisions

## D-001: Product Scope Freeze

- Status: Approved
- Meridian MVP is an agency SaaS only
- Publisher and advertiser platform concepts are excluded from MVP

## D-002: Tenant Model

- Status: Approved
- `Organization` is the root tenant
- All operational data is owned by and scoped to a single organization

## D-003: Architecture Separation

- Status: Approved
- `Next.js` is the frontend presentation layer
- `Node.js` API owns all business logic and authorization
- No Next.js fullstack business implementation
- Async processing runs in a separate worker

## D-004: Repository Strategy

- Status: Approved
- Meridian uses a monorepo
- Top-level structure:
  - `apps/web`
  - `apps/api`
  - `apps/worker`
  - `packages/contracts`
  - `tests`
  - `infra`
  - `scripts`

## D-005: API Contract First

- Status: Approved
- `API_CONTRACT.md` is the single source of truth for API behavior
- Development order:
  - Requirement
  - API contract
  - Backend
  - Frontend
  - Testing

## D-006: MVP Support Entities

- Status: Approved
- The MVP domain includes the following support entities in addition to business records:
  - `Session`
  - `AuthChallengeToken`
  - `OfferAssignment`
  - `PayoutBatch`
  - `ReportAggregate`

## D-007: Bootstrap Guardrail

- Status: Approved
- Phase 0 may initialize repository structure, state files, and project scaffolding
- Phase 0 must not implement business features, business modules, or authentication workflows

## D-008: Workspace Package Manager

- Status: Approved
- Meridian uses `npm` workspaces for MVP bootstrap
- Workspace roots:
  - `apps/*`
  - `packages/*`
- Reason:
  - simplest supported monorepo path for the current team size
  - low bootstrap overhead
  - enough structure for separated web, api, worker, and shared contracts

## D-009: Shared Configuration Baseline

- Status: Approved
- Root bootstrap includes:
  - shared `tsconfig.base.json`
  - root ESLint baseline
  - root Prettier baseline
  - root `.editorconfig`
  - root `.gitignore`
- These files define repository-wide defaults only
- App-specific runtime configuration remains Phase 0.2 work

## D-010: Environment Strategy Baseline

- Status: Approved
- Environment shape is defined in root `.env.example`
- Secret-bearing values are placeholder-only and never committed with real values
- Frontend may consume only public configuration values
- API and worker own sensitive runtime configuration

## D-011: Runtime Skeleton Boundary

- Status: Approved
- `apps/web` may contain presentation routing, layout, and UI shell code only
- `apps/api` owns server runtime, operational routes, request context, and error handling
- `apps/worker` owns async runtime bootstrap only in Phase 0.2
- No business modules or authentication flows are implemented in this phase

## D-012: Bootstrap Logging and Error Conventions

- Status: Approved
- API and worker logs use structured JSON output
- API responses use the contract-aligned error envelope shape
- Request correlation starts with `x-request-id`
- These are baseline conventions and may be extended in later phases without changing ownership boundaries

## D-013: Phase 0.3 Delivery Baseline

- Status: Approved
- Delivery baseline includes:
  - source-file linting
  - direct TypeScript validation
  - workspace build validation
  - integration checks for operational endpoints
  - contract checks for operational endpoints
  - CI workflow baseline in `.github/workflows/ci.yml`

## D-014: Bootstrap Test Execution Strategy

- Status: Approved
- Bootstrap integration and contract tests execute as direct Node scripts
- Reason:
  - the current Windows sandbox blocks Node subprocess patterns used by `node:test` and `tsx`
  - direct executable checks are reliable in this environment
- This is a Phase 0 delivery decision only and may be upgraded to a richer test runner later

## D-015: TODO Scope

- Status: Approved
- `TODO.md` tracks the full approved implementation backlog through Phase 12
- Completed work remains checked off in place
- Future phases remain pending until explicitly started and approved

## D-016: Phase 1.1 Auth Core Scope

- Status: Approved
- Phase 1.1 implements auth core only:
  - signup
  - email verification
  - login
  - logout
  - current session
  - password reset request
  - password reset completion
- Organization onboarding, multi-session management, and change-password remain outside Phase 1.1
- Reason:
  - keeps the first auth slice aligned with the approved roadmap
  - avoids pulling Phase 1.2 organization work into the auth foundation

## D-017: Auth Test Database Strategy

- Status: Approved
- Production runtime continues to execute SQL migrations through the migration runner
- Auth unit, integration, and contract tests seed the auth schema directly into `pg-mem` and start the runtime with `skipMigrations: true`
- Reason:
  - `pg-mem` is unstable on the repeated migration bootstrap path used by the runtime
  - direct schema seeding keeps Phase 1.1 verification deterministic without changing production behavior

## D-018: Accepted MVP Security Debt

- Status: Approved
- The following controls are intentionally deferred and tracked as accepted technical debt for MVP:
  - CSRF protection
  - rate limiting
  - login throttling
  - password reset throttling
  - audit logging
- Reason:
  - Phase 1 focuses on establishing the tenant-safe auth and onboarding foundation first
  - these controls remain mandatory follow-up work and are already represented in later roadmap phases

## D-019: Password Hashing Strategy

- Status: Approved
- `bcryptjs` with 12 rounds remains the approved MVP password hashing implementation
- `Argon2id` is the preferred future password hashing strategy once the platform is ready to absorb the migration and operational complexity
- Reason:
  - keeps the current auth slice simple and stable
  - records the intended stronger long-term hashing direction without changing the MVP gate

## D-020: Tenant Access Source of Truth

- Status: Approved
- Tenant access is derived only through the chain:
  - `User` -> `Membership` -> `Organization`
- `Session.active_organization_id` may hold the user's current org selection, but it never grants access by itself
- Every org-scoped request must validate both:
  - an authenticated session
  - an active membership linking the session user to the target organization
- `user.organization_id` shortcuts are prohibited
- Reason:
  - preserves a single source of tenant access truth
  - prevents accidental bypass of membership validation in later phases

## D-021: Browser-to-API Session Transport

- Status: Approved
- The Next.js presentation layer calls the Node API directly for onboarding and auth-adjacent flows
- The API allows credentialed browser requests only from the configured web origin
- Reason:
  - preserves the separated frontend/backend architecture
  - avoids introducing a Next.js backend-for-frontend layer during MVP

## D-022: Active Organization Session Semantics

- Status: Approved
- `sessions.active_organization_id` stores the current organization selection for a specific authenticated session
- It is a convenience pointer only
- It never replaces membership validation
- If the stored selection no longer resolves through an active membership, the API clears it and returns no current organization
- Reason:
  - keeps current-org behavior explicit and tenant-safe
  - avoids stale session state turning into an implicit access grant

## D-023: MVP RBAC Baseline

- Status: Approved
- Fixed role inventory:
  - `owner`
  - `admin`
  - `manager`
  - `analyst`
  - `viewer`
- Role hierarchy:
  - `owner` > `admin` > `manager` > `analyst` > `viewer`
- Permission boundaries:
  - `viewer`
    - read-only access to allowed organization-scoped data
  - `analyst`
    - viewer permissions
    - reporting and export reads where later modules allow them
  - `manager`
    - analyst permissions
    - operational CRUD for non-financial business records in later phases
  - `admin`
    - manager permissions
    - team administration
    - organization administration except owner-only actions
  - `owner`
    - full tenant authority
    - ownership-sensitive actions
- Membership status:
  - `active`
  - `deactivated`
- Membership deactivation removes organization access immediately
- Custom roles are intentionally excluded from MVP
- Runtime role inheritance is intentionally excluded from MVP
- Reason:
  - fixed roles and a static policy map are the simplest safe RBAC model for the approved MVP

## D-024: Owner and Membership Safety Rules

- Status: Approved
- Every organization must always have at least one active `owner`
- The system must block:
  - demoting the last active owner
  - deactivating the last active owner
  - removing the last active owner
- Only `owner` can assign or remove `owner`
- Only `owner` can assign or remove `admin`
- `admin` may manage only `manager`, `analyst`, and `viewer` memberships
- Self-role changes and self-deactivation are disallowed in MVP
- Reason:
  - these rules minimize privilege-escalation edge cases while keeping team management usable

## D-025: Billing Permission Baseline

- Status: Approved
- Billing visibility:
  - `owner`: allowed
  - `admin`: allowed
  - `manager`: denied
  - `analyst`: denied
  - `viewer`: denied
- Billing-related organization settings:
  - `owner`: allowed when those settings are implemented
  - `admin`: denied
  - `manager`: denied
  - `analyst`: denied
  - `viewer`: denied
- Subscription or plan mutation:
  - remains `Platform Admin` only until a full customer-facing billing workflow is implemented
- Reason:
  - owner-level billing read/write is reasonable for future customer billing UX
  - subscription-state mutation is too sensitive to expose to tenant users before billing flows, reconciliation, and entitlement controls exist

## D-026: Audit Log Access Baseline

- Status: Approved
- Audit log visibility:
  - `owner`: allowed
  - `admin`: allowed
  - `manager`: denied
  - `analyst`: denied
  - `viewer`: denied
- Reason:
  - owner and admin are the two operational roles that need investigation access in MVP
  - extending audit visibility below admin increases privacy and misuse risk without clear MVP value

## D-027: Invite Lifecycle Baseline

- Status: Withdrawn
- Invite-based team onboarding is no longer part of Meridian MVP
- Reason:
  - Meridian work accounts are internal agency accounts provisioned directly by `owner` or `admin`
  - a Slack-style invite/acceptance model adds unnecessary operational complexity for the approved internal-agency workflow

## D-028: Admin-Provisioned Work Account Model

- Status: Approved
- `owner` and `admin` create employee work accounts directly inside the active organization
- Account provisioning creates:
  - a `User`
  - a `Membership`
  - an initial password-reset or password-setup requirement for first login
- Admin-provisioned work accounts are created in verified-email state because they are internal agency-controlled work accounts rather than self-registered personal accounts
- The employee does not need to accept an invite before the membership exists
- The employee must set a new password on first use before normal access is granted
- `owner` may create any role
- `admin` may create only `manager`, `analyst`, or `viewer`
- No creation flow may assign a role higher than the acting membership may assign
- Membership deactivation remains the MVP access-removal mechanism
- `DELETE /memberships/{membership_id}` remains excluded from MVP
- Reason:
  - this matches the internal agency work-account model
  - it preserves direct administrative control without introducing invite lifecycle state

## D-029: Team Assignment and Executive Visibility Follow-Up

- Status: Approved
- Phase 2.2 is redesigned to cover:
  - direct employee account creation by `owner` or `admin`
  - manager assignment at account creation time when applicable
  - reassignment of a user into or out of a manager's team
- Lowest-level executives must eventually see only the campaigns explicitly assigned to them
- Campaign-assignment visibility is approved in principle but is deferred until Offer Management design
- Reason:
  - manager-team relationships are needed now for work-account provisioning
  - campaign-level visibility depends on later campaign and assignment models and should not be guessed early

## D-030: Work Account First-Login and Lifecycle Model

- Status: Approved
- Admin-provisioned work accounts use forced first-login password setup
- Provisioning creates:
  - a `User`
  - a `Membership`
  - a one-time password-setup or password-reset challenge
- Newly provisioned users cannot establish a normal authenticated application session until the initial password-setup challenge is completed
- MVP work-account lifecycle states:
  - `provisioned`
    - created by `owner` or `admin`
    - membership exists
    - normal application access blocked until password setup completes
  - `active`
    - password setup completed
    - normal application access allowed, subject to membership and RBAC
  - `deactivated`
    - account access disabled for the organization through membership deactivation
- No temporary admin-known permanent password is part of the approved model
- Reason:
  - this preserves direct internal provisioning while avoiding shared long-lived credentials

## D-031: Manager Assignment Model

- Status: Approved
- Manager assignment is organization-scoped and applies to memberships, not to organization access itself
- The simplest MVP data model is:
  - an optional manager reference from a subordinate membership to one active manager membership in the same organization
- Manager assignment is nullable
- `owner` and `admin` may set, change, or clear manager assignment
- Manager assignment may be provided at employee account creation time
- Manager selection may be displayed by manager name or email in the UI, but the system must bind it by immutable membership ID, never by name
- In MVP, only subordinate operational roles may have manager assignment:
  - `analyst`
  - `viewer`
- `owner`, `admin`, and `manager` do not have managers assigned in MVP
- Reason:
  - this gives Meridian a concrete team structure without introducing a generic hierarchy framework

## D-032: Manager Hierarchy Depth Limit

- Status: Approved
- Manager hierarchy depth is limited to one level in MVP
- Nested manager trees are excluded
- A manager may have subordinates, but a manager may not also be assigned to another manager
- Reason:
  - one-level team ownership is enough for the approved internal-agency workflow
  - deeper hierarchies add query, mutation, and authorization complexity without present need

## D-033: Campaign Visibility Deferral and Lowest-Level Access Rule

- Status: Approved
- Campaign-level record visibility for the lowest-level role is deferred until Offer Management
- Current `viewer` remains the lowest-level read-only role for MVP unless explicitly changed later
- When Offer Management begins, the offer or campaign model must include explicit assignment support so `viewer` users can see only campaigns assigned to their membership
- `viewer` users remain unable to create or edit campaigns
- This visibility rule must flow through:
  - campaign list and detail views
  - tracking-related campaign views where relevant
  - conversion views where relevant
  - payout and reporting reads that expose campaign-level data
- Reason:
  - the requirement is approved, but the correct enforcement point is the later campaign model, not Phase 2.2 membership work

## D-034: Direct Provisioning Password-Setup Token Handling

- Status: Approved
- Direct employee account provisioning returns a one-time password-setup token in the API response to the acting `owner` or `admin`
- The token is the same security class as a password-reset token
- Meridian MVP does not require an invite or email-delivery dependency for this workflow
- The provisioning flow therefore relies on operational handoff of the one-time token by the agency administrator
- Any future frontend for this flow must treat the token as sensitive and avoid durable client-side persistence beyond immediate operator use
- Reason:
  - this preserves the approved internal work-account model
  - it avoids reintroducing invite complexity
  - it keeps first-login credential ownership with the employee rather than the administrator

## D-035: Publisher Record Baseline

- Status: Approved
- Publisher records are agency-owned tenant-scoped master records for Phase 3.1
- Required fields:
  - `name`
- Optional fields:
  - `website_url`
  - `primary_contact_name`
  - `primary_contact_email`
  - `notes`
- Publisher lifecycle states:
  - `active`
  - `archived`
- Website or domain is not required in MVP
- Duplicate detection is blocking, not warning-only
- Duplicate detection rule:
  - exact normalized publisher name must be unique within the same organization among `active` publisher records
- Archived publisher records do not participate in active duplicate checks
- Restore must fail if an active publisher in the same organization already uses the same normalized name
- No uniqueness rule is enforced on website or domain in MVP
- Reason:
  - this is the simplest tenant-safe publisher model that supports operational CRUD without introducing fuzzy dedupe, global identity resolution, or premature CRM abstractions

## D-036: Advertiser Record Baseline

- Status: Approved
- Advertiser records are agency-owned tenant-scoped master records for Phase 3.2
- Required fields:
  - `name`
- Optional fields:
  - `website_url`
  - `primary_contact_name`
  - `primary_contact_email`
  - `notes`
- Advertiser lifecycle states:
  - `active`
  - `archived`
- Website or domain is not required in MVP
- Duplicate detection is blocking, not warning-only
- Duplicate detection rule:
  - exact normalized advertiser name must be unique within the same organization among `active` advertiser records
- Archived advertiser records do not participate in active duplicate checks
- Restore must fail if an active advertiser in the same organization already uses the same normalized name
- No uniqueness rule is enforced on website or domain in MVP
- Publisher and advertiser records have no meaningful behavioral differences in MVP
- A future shared abstraction for publisher and advertiser master-record behavior is possible
- Refactoring to a shared abstraction is intentionally deferred until after MVP or until a real behavioral divergence or maintenance burden appears
- Reason:
  - this keeps Phase 3.2 aligned with the simplest working tenant-scoped CRUD model
  - it avoids introducing a speculative shared abstraction before the offer, tracking, conversion, and payout modules prove whether these records truly need one

## D-037: Offer Assignment Ownership and Viewer Visibility

- Status: Approved
- `OfferAssignment` remains the organization-owned operational link between:
  - one `Offer`
  - one `PublisherRecord`
- `OfferAssignment` does not belong to `Membership` as its authority owner
- Viewer-level campaign visibility is a separate internal access concern and is not the same thing as publisher linkage
- MVP visibility model:
  - `owner`, `admin`, `manager`, and `analyst` may see all offers and offer assignments in the active organization
  - `viewer` may see only offers explicitly assigned to that viewer membership
- Recommended MVP implementation:
  - add a direct offer-level assignee membership reference for `viewer` visibility
  - do not overload `OfferAssignment` to act as the employee-access model
- Visibility enforcement points for `viewer`:
  - offer list: enforced
  - offer detail: enforced
  - reporting: enforced anywhere campaign-level data is exposed
  - tracking reads: enforced where offer-level tracking reads are surfaced internally
  - conversion reads: enforced where offer-level conversion data is surfaced internally
  - payout reads: enforced where offer-level payout data is surfaced internally
- Reason:
  - publisher delivery linkage and internal employee visibility are different concerns
  - keeping viewer assignment on the offer avoids coupling employee access to publisher-specific routing rows

## D-038: Offer Assignment Conversion Visibility and Postback Controls

- Status: Approved
- `OfferAssignment` supports two publisher-facing controls in MVP:
  - `conversion_visibility_percent`
  - `postback_percent`
- The two percentages may differ
- Recommended selection model:
  - deterministic, not randomized per request
  - use a stable assignment-scoped hash input from the attributed click or conversion identity so the same conversion resolves the same way on replay
- Hidden conversion behavior:
  - internal reporting: included
  - payout calculations: included
  - internal tracking and conversion reads: included
  - publisher-facing postback delivery: suppressed when outside the configured postback percentage
- Internal meaning of conversion visibility percentage:
  - record the visibility outcome on the conversion or assignment result for future publisher-facing exposure
  - do not hide the conversion from agency users in MVP
- Audit requirements:
  - changing either percentage requires audit logging
  - manual reprocess or replay actions taken after percentage changes require audit logging
- Recommended MVP implementation:
  - keep both controls on `OfferAssignment`
  - compute deterministic flags during attribution/finalization
  - preserve internal financial truth regardless of publisher-facing suppression
- Reason:
  - publisher-facing visibility and postback suppression are assignment-specific delivery controls, not financial truth controls

## D-039: Offer Lifecycle Model

- Status: Approved
- Offer lifecycle states:
  - `draft`
  - `active`
  - `paused`
  - `archived`
- `draft` is required in MVP
- `pause` and `resume` exist in MVP
- `archive` exists in MVP
- State transition rules:
  - create -> `draft`
  - `draft` -> `active`
  - `active` -> `paused`
  - `paused` -> `active`
  - `draft` -> `archived`
  - `active` -> `archived`
  - `paused` -> `archived`
  - `archived` -> `draft` on restore
- Reason:
  - offers need a safe incomplete state before activation
  - restore to `draft` is safer than restoring directly to traffic-bearing state

## D-040: Offer Assignment Lifecycle and Offer RBAC Baseline

- Status: Approved
- Offer assignment lifecycle states:
  - `active`
  - `paused`
  - `archived`
- Assignment `draft` state is intentionally excluded from MVP
- Assignment `pause` and `resume` exist in MVP
- Assignment `archive` exists in MVP
- State transition rules:
  - create -> `active`
  - `active` -> `paused`
  - `paused` -> `active`
  - `active` -> `archived`
  - `paused` -> `archived`
  - `archived` -> `paused` on restore
- Offer RBAC baseline:
  - `owner`: create, update, archive, restore
  - `admin`: create, update, archive, restore
  - `manager`: create, update, archive, restore
  - `analyst`: no write access
  - `viewer`: no write access
- Offer assignment RBAC baseline:
  - `owner`: create, update, pause, resume, archive, restore
  - `admin`: create, update, pause, resume, archive, restore
  - `manager`: create, update, pause, resume, archive, restore
  - `analyst`: no write access
  - `viewer`: no write access
- Reason:
  - assignments are simpler operational rows than offers and do not need a `draft` state
  - restoring archived assignments to `paused` avoids accidental traffic resumption

## D-041: Offer Core Ownership, Fields, and MVP Payout Architecture

- Status: Approved
- Every `Offer` belongs to exactly one `AdvertiserRecord`
- Orphan offers are not allowed
- Offer required fields in MVP:
  - `advertiser_id`
  - `name`
- Offer optional fields in MVP:
  - `description`
  - `tracking_slug`
  - `terms`
  - `start_at`
  - `end_at`
  - `daily_cap`
  - `monthly_cap`
  - `overall_cap`
- Offer uniqueness rule:
  - exact normalized offer name must be unique within the same organization for the same advertiser among non-archived offers
- Offer tracking assumptions:
  - public tracking resolves through `OfferAssignment`, not through `Offer` alone
  - `Offer` owns business identity and advertiser event payout definitions
  - `OfferAssignment` owns publisher-specific delivery and payout override controls
- MVP payout architecture replaces the earlier single fixed-payout assumption
- Each `Offer` may define multiple advertiser-specific conversion event types
- Supported MVP event types include:
  - `lead`
  - `registration`
  - `install`
  - `deposit`
  - `sale`
  - `custom`
- Each event type has its own advertiser payout amount
- Publisher tiers are frozen in MVP as:
  - `tier_1`
  - `tier_2`
  - `tier_3`
  - `tier_4`
- Tier percentages are configurable and must not be hardcoded
- Recommended MVP ownership for payout configuration:
  - publisher tier assignment belongs to `PublisherRecord`
  - tier percentage configuration belongs to the organization payout settings model
  - custom publisher payout overrides belong to `OfferAssignment`, scoped by event type
- Publisher payout resolution order is frozen as:
  1. custom publisher override
  2. publisher tier percentage
  3. advertiser event payout
- Examples:
  - advertiser `sale` payout = `$10`, publisher `tier_4` = `80%`, no override -> publisher payout = `$8`
  - advertiser `sale` payout = `$10`, publisher `tier_4` = `80%`, override = `$9` -> publisher payout = `$9`
- Explicitly excluded from MVP:
  - country-based payouts
  - device-based payouts
  - rule-engine payouts
  - formula builders
  - nested payout conditions
  - dynamic expression systems
- Expected future expansion:
  - yes, payout-model expansion is expected after MVP
- Approved architecture requirement:
  - Phase 4 implementation must support offer event definitions, publisher tier assignment, tier percentage configuration, and optional custom overrides without requiring redesign of conversion, payout, or reporting flows later
- Reason:
  - this is the minimum payout architecture that matches the approved agency workflow while still remaining bounded and deterministic for MVP

## D-042: Publisher Tier Ownership and Configuration Model

- Status: Approved
- Publisher tier assignment is organization-scoped
- Publisher tier is assigned to `PublisherRecord`
- The same real-world publisher may have different tiers in different organizations
- Tier assignment is not global
- Frozen MVP tier set:
  - `tier_1`
  - `tier_2`
  - `tier_3`
  - `tier_4`
- Tier percentages are configurable
- Tier percentages must not be hardcoded
- Tier percentages are organization-owned settings
- Tier configuration permissions:
  - `owner`: may assign publisher tiers, change publisher tiers, edit tier percentages
  - `admin`: may assign publisher tiers, change publisher tiers, edit tier percentages
  - `manager`: may not edit tier configuration
  - `analyst`: may not edit tier configuration
  - `viewer`: may not edit tier configuration
- Reason:
  - publisher monetization is a tenant-specific commercial policy and cannot be modeled safely as a global publisher property

## D-043: Offer Assignment Override Model and Payout Resolution

- Status: Approved
- Custom publisher payout overrides remain supported in MVP
- Overrides are stored on `OfferAssignment`
- Overrides are event-type scoped
- Override values are fixed payout amounts
- Percentage-based overrides are not supported in MVP
- Publisher payout resolution order is frozen as:
  1. custom publisher override
  2. publisher tier percentage
  3. advertiser event payout
- Examples:
  - advertiser `sale` payout = `$10`, publisher `tier_4` = `80%`, no override -> publisher payout = `$8`
  - advertiser `sale` payout = `$10`, publisher `tier_4` = `80%`, override = `$9` -> publisher payout = `$9`
- Reason:
  - fixed-amount overrides are enough to support negotiated exceptions without introducing a second percentage system or an expression engine

## D-044: Finalized Conversion Snapshot and Non-Retroactive Financial Rules

- Status: Approved
- When a conversion is finalized, the system must snapshot:
  - advertiser payout
  - publisher payout
  - event type
  - publisher tier
  - effective payout source
- Effective payout source means whether publisher payout resolved from:
  - custom override
  - tier percentage
- Historical financial records must remain stable after finalization
- Tier percentage changes are never retroactive
- Advertiser event payout changes are never retroactive
- Custom override changes are never retroactive
- Historical conversions must never be recalculated automatically because of later configuration changes
- Reason:
  - conversion finalization is the financial lock point for reporting, reconciliation, and payout integrity

## D-045: Audit Requirements for Payout-Affecting Configuration

- Status: Approved
- The following actions require audit logging:
  - tier assignment changes
  - tier percentage changes
  - advertiser event payout changes
  - custom override changes
  - manual payout-affecting reprocessing
- Reason:
  - payout-affecting configuration changes alter future financial outcomes and must be attributable for operations and dispute handling

## D-046: Offer Event Storage and Tracking Slug Semantics

- Status: Approved
- Offer event definitions are explicit offer-defined records
- Each event definition stores:
  - `event_code`
  - `event_name`
  - `advertiser_payout`
- Standard advertiser event types use canonical event codes:
  - `lead`
  - `registration`
  - `install`
  - `deposit`
  - `sale`
- Custom events are not free-text conversion payload values
- Custom events must be explicit offer-defined records with their own stable `event_code` and `event_name`
- `event_code` is the machine identifier and must be unique within one offer
- `event_name` is the human-facing display label
- `advertiser_payout` is stored per event definition
- `tracking_slug` is informational only in MVP
- Attribution and public tracking resolution must never depend on `tracking_slug`
- Public tracking must continue to resolve through `OfferAssignment` and assignment-owned tracking tokens or identifiers
- Reason:
  - explicit event-definition records are the minimum stable model for advertiser-specific payouts
  - keeping `tracking_slug` non-authoritative prevents a presentation-friendly field from becoming an accidental attribution key

## D-047: Phase 4.1 Viewer Offer Read Gating

- Status: Approved
- Viewer-level offer visibility remains assignment-scoped by architecture
- Explicit viewer assignment support is not implemented in Phase 4.1
- Until Phase 4.2 introduces assignment-based visibility enforcement, `viewer` memberships do not receive offer list or offer detail access
- `owner`, `admin`, `manager`, and `analyst` may read offers in Phase 4.1
- Reason:
  - denying premature viewer reads is safer than exposing all offers before assignment filtering exists
  - this preserves the approved assignment-based visibility model without forcing Phase 4.2 work into the Offer core slice

## D-048: Offer Assignment Uniqueness, Tracking Authority, and Snapshot Rules

- Status: Approved
- `OfferAssignment` required fields in MVP:
  - `offer_id`
  - `publisher_id`
- `OfferAssignment` optional fields in MVP:
  - `conversion_visibility_percent`
  - `postback_percent`
  - event-scoped fixed payout overrides
- Percentage fields are optional because the MVP default is full publisher-facing exposure:
  - omitted `conversion_visibility_percent` = `100`
  - omitted `postback_percent` = `100`
- Percentage values are integer percentages from `0` to `100`
- Uniqueness rule:
  - at most one non-archived assignment may exist for the same `Offer + Publisher` pair in one organization
  - this means Meridian also permits only one active assignment for the same `Offer + Publisher` pair
  - `paused` assignments still reserve the pair
  - restore must fail if another non-archived assignment already exists for the same `Offer + Publisher` pair
- Tracking authority model:
  - public tracking resolves through `OfferAssignment`, not through `Offer`
  - tracking links and tracking identifiers are assignment-owned
  - click ingestion must derive organization, offer, and publisher context from the resolved assignment
  - frontend or public callers must never supply authoritative organization, offer, or publisher IDs for tracking resolution
- Conversion visibility percentage evaluation:
  - deterministic, not random per request
  - use a stable assignment-scoped and conversion-scoped hash input so replay produces the same outcome
  - the same finalized conversion must always resolve the same visibility result unless an explicit manual reprocess occurs
- Postback percentage evaluation:
  - deterministic, not random per request
  - use the same stable assignment-scoped and conversion-scoped hash input family so replay produces the same outcome
  - visibility and postback percentages may differ, so their boolean outcomes may differ
- Snapshot requirements at conversion finalization:
  - snapshot the assignment identifier used for attribution
  - snapshot publisher conversion visibility outcome
  - snapshot publisher postback eligibility outcome
  - snapshotting these outcomes is mandatory because later assignment setting changes are not retroactive
- Reason:
  - one non-archived assignment per offer/publisher pair keeps tracking authority unambiguous
  - deterministic decisions are required for replay safety, payout integrity, and publisher dispute handling
  - outcome snapshotting keeps historical behavior stable after configuration changes

## D-049: Publisher-Level and Assignment-Level Postback Ownership Model

- Status: Approved
- Publisher-level postback control is part of MVP
- `PublisherRecord` owns:
  - `publisher_tier`
  - `publisher_postback_percent`
- `publisher_postback_percent` is organization-scoped
- Default `publisher_postback_percent` is `100`
- `publisher_postback_percent` permissions:
  - `owner`: may edit
  - `admin`: may edit
  - `manager`: may not edit
  - `analyst`: may not edit
  - `viewer`: may not edit
- Purpose of `publisher_postback_percent`:
  - defines the maximum publisher-wide postback exposure allowed for that publisher within the organization
- `OfferAssignment` retains assignment-level postback control:
  - `postback_percent`
- `postback_percent` is assignment-owned
- Default `postback_percent` is `100`
- Purpose of assignment-level `postback_percent`:
  - allows offer-specific postback restrictions for the assigned publisher
- Effective postback resolution is frozen as:
  - `MIN(publisher_postback_percent, assignment_postback_percent)`
- Examples:
  - publisher `40`, assignment `80` -> effective `40`
  - publisher `90`, assignment `80` -> effective `80`
  - publisher `100`, assignment `100` -> effective `100`
  - publisher `0`, assignment `100` -> effective `0`
- Postback eligibility remains deterministic:
  - use stable assignment-scoped and conversion-scoped hash inputs
  - replay must produce the same result unless a manual reprocess occurs
- At conversion finalization, snapshot:
  - `offer_assignment_id`
  - `publisher_postback_percent`
  - `assignment_postback_percent`
  - `effective_postback_percent`
  - postback eligibility outcome
- These postback values become immutable historical facts after finalization
- Non-retroactive rule:
  - changes to `publisher_postback_percent` never retroactively change finalized conversions
  - changes to assignment-level `postback_percent` never retroactively change finalized conversions
  - only future conversions use the new configuration unless a manual payout-affecting reprocess is explicitly performed
- Audit requirements:
  - publisher postback percentage changes require audit logging
  - assignment postback percentage changes require audit logging
  - manual reprocessing that affects postback eligibility requires audit logging
- Final ownership summary:
  - `PublisherRecord` owns:
    - `publisher_tier`
    - `publisher_postback_percent`
  - `OfferAssignment` owns:
    - `conversion_visibility_percent`
    - assignment-level `postback_percent`
    - event-scoped fixed payout overrides
- Reason:
  - publisher-wide and offer-specific postback exposure are different controls
  - using the minimum rule keeps the system conservative and operationally predictable
  - snapshotting prevents later configuration edits from corrupting historical postback facts

## D-050: Default Publisher Tier Percentages

- Status: Approved
- New organizations seed publisher tier percentages as:
  - `tier_1` = `40`
  - `tier_2` = `55`
  - `tier_3` = `70`
  - `tier_4` = `80`
- These are default organization-owned settings only
- They remain editable by `owner` and `admin`
- Reason:
  - Phase 4.2 needs concrete seeded tier values so publisher-tier payout behavior is operational immediately after organization creation
  - seeding defaults now avoids null commercial configuration while preserving tenant-level control

## D-051: Viewer Assignment Mutation and OfferAssignment Pair Stability

- Status: Approved
- Offers may carry one nullable viewer-assignee membership reference for lowest-level visibility enforcement
- Only `owner` or `admin` may set or clear viewer assignment on an offer
- `manager` may create and update offers without changing existing viewer assignment
- `viewer` assignment targets must resolve to active `viewer` memberships in the same organization
- `OfferAssignment` pair identity is immutable after creation:
  - `offer_id` and `publisher_id` do not change on update
  - changing the pair requires archiving the existing assignment and creating a new one
- Tracking links are assignment-owned and exposed as opaque `/t/{tracking_token}` paths
- Public tracking interfaces must not expose internal database identifiers
- Reason:
  - viewer visibility and publisher linkage need stable, separate enforcement points
  - immutable assignment pairs keep tracking authority unambiguous and simplify restore-conflict validation

## D-052: MVP Viewer Assignment Cardinality

- Status: Approved
- Offer-level viewer assignment remains single-viewer in MVP
- One offer may be assigned to:
  - zero viewer memberships
  - exactly one active `viewer` membership in the same organization
- Multi-viewer visibility is intentionally excluded from MVP
- `owner` and `admin` remain the only roles that may set or clear viewer assignment
- Future scalability path:
  - if one offer must later be visible to multiple viewers or teams, Meridian should move to an explicit offer-to-membership visibility join model
  - that future model must remain separate from `OfferAssignment`
- Reason:
  - the current lowest-level visibility rule is satisfied by a single-viewer model
  - this keeps Offer reads simple and tenant-safe without introducing a speculative many-to-many access layer

## D-053: OfferAssignment Tracking Token Identity Model

- Status: Approved
- `OfferAssignment` tracking identity is an assignment-owned opaque routing token
- The tracking token is separate from all public record identifiers
- Tracking token generation rules:
  - generated server-side only
  - cryptographically random
  - minimum 256-bit entropy
- Tracking token uniqueness rules:
  - globally unique across assignments
  - enforced by datastore uniqueness
  - never intentionally reused
- Tracking token immutability rules:
  - generated once when the assignment is created
  - does not change on update
  - does not change on pause
  - does not change on archive
  - does not change on restore
- Archive and restore behavior:
  - archived assignments retain their historical tracking token
  - restored assignments keep the same tracking token
  - if a new assignment is created for the same offer and publisher after the old assignment is archived, the new assignment receives a new tracking token
  - the historical token from the archived assignment must never be rebound to a different assignment
- Public-ingest behavior requirement:
  - tracking resolution must derive organization, offer, and publisher context only from the resolved assignment token
  - public click ingest must reject non-traffic-eligible assignment state rather than rotating tokens
- Security boundary:
  - tracking tokens are public-routing identities, not public record IDs
  - internal database identifiers must never appear in public tracking interfaces
- Reason:
  - tracking needs a stable public routing identity that survives lifecycle state changes
  - separating tracking tokens from record IDs keeps public traffic routing and business identity concerns cleanly isolated

## D-054: Long-Term Public Identifier Strategy

- Status: Approved
- All externally referenced business entities use backend-generated opaque immutable public identifiers
- This strategy applies to:
  - `Organization`
  - `Membership`
  - `PublisherRecord`
  - `AdvertiserRecord`
  - `Offer`
  - `OfferAssignment`
  - `Click`
  - `Conversion`
  - `PayoutBatch`
  - `Payout`
- Public identifier rules:
  - entity-prefixed
  - opaque
  - immutable
  - no business meaning encoded
  - never recycled
- Reserved MVP public prefixes:
  - `org`
  - `mem`
  - `pub`
  - `adv`
  - `off`
  - `asg`
  - `clk`
  - `cnv`
  - `pbt`
  - `pay`
- Internal database identifiers remain private implementation detail
- Public identifiers must be used in:
  - API paths
  - API request references
  - API response objects
  - internal admin and support tooling where record lookup leaves the persistence boundary
- Public identifiers must not be used as:
  - authorization grants
  - tracking-route tokens
  - secret-bearing credentials
- Tracking tokens remain a separate identifier class for public traffic routing
- Reason:
  - prefixed opaque IDs are easier to validate, safer to expose, simpler to debug, and decoupled from storage internals
  - one consistent identifier policy across all business entities prevents later API drift between modules

## D-055: MVP Campaign Visibility Simplification

- Status: Approved
- Campaign-level visibility restrictions are withdrawn from MVP
- `viewer_membership_id` on `Offer` is removed from the MVP model
- Viewer-specific filtering is removed from:
  - offer list reads
  - offer detail reads
  - offer-assignment list reads
  - offer-assignment detail reads
  - offer-assignment tracking-link reads
- MVP offer and offer-assignment read visibility is now:
  - `owner`: all records in the active organization
  - `admin`: all records in the active organization
  - `manager`: all records in the active organization
  - `analyst`: all records in the active organization
  - `viewer`: all records in the active organization
- Tenant isolation remains unchanged:
  - `User` -> `Membership` -> `Organization`
- Role write permissions remain unchanged
- Future enhancement only:
  - Meridian V2 may introduce `offer_visibility_assignments`
  - that future model should be many-to-many between `Offer` and `Membership`
  - executive-specific campaign visibility remains out of MVP
- Supersedes the MVP visibility portions of:
  - `D-037`
  - `D-047`
  - `D-051`
  - `D-052`
- Reason:
  - the current single-viewer model adds complexity to offer reads, offer forms, contracts, and tests without being required for MVP tenant safety
  - organization-scoped read visibility is sufficient for Phase 5 and later core infrastructure work

## D-056: Public Tracking Redirect Authority and Traffic Eligibility

- Status: Approved
- Public tracking redirects are assignment-owned
- `OfferAssignment` owns `redirect_url`
- Public click resolution must never trust caller-supplied:
  - organization identifiers
  - offer identifiers
  - advertiser identifiers
  - publisher identifiers
  - assignment identifiers
- Organization, offer, advertiser, publisher, and assignment context must be derived only from the resolved tracking token
- Public click traffic is accepted only when all of the following are true:
  - assignment status is `active`
  - offer status is `active`
  - publisher status is `active`
  - advertiser status is `active`
  - assignment has a configured `redirect_url`
- Public click traffic is rejected when the tracking token is unknown or the resolved assignment is not traffic-eligible
- Unknown-token and non-traffic-eligible cases use the same public failure contract:
  - HTTP `404`
  - `tracking_unavailable`
  - no redirect
- Malformed tracking tokens use:
  - HTTP `400`
  - `tracking_token_invalid`
  - no redirect
- Successful public click handling uses:
  - HTTP `302`
  - `Location` header set to the trusted assignment `redirect_url`
- Tracking tokens are not rotated during pause, archive, restore, or public rejection handling
- Reason:
  - tracking must have one trusted redirect authority
  - public click failure responses should not disclose token existence or assignment lifecycle state

## D-057: Click Identity and Persistence Baseline

- Status: Approved
- Clicks are first-class immutable tracking facts in MVP
- Click public IDs use the opaque immutable `clk_*` identifier strategy
- Click public IDs:
  - are generated server-side
  - are not authorization mechanisms
  - are never reused
- Click persistence must store the resolved public business identifiers for:
  - organization
  - offer assignment
  - offer
  - publisher
  - advertiser
- Click persistence must also store:
  - click timestamp
  - tracking token hash
  - tracking resolution status
  - resolved redirect URL
  - request metadata required for future attribution
- Click read APIs are internal-only primitives for future attribution work
- Click reads are permitted to:
  - `owner`
  - `admin`
  - `manager`
  - `analyst`
- Click reads are denied to:
  - `viewer`
- Future hardening remains deferred:
  - rate limiting
  - abuse controls
  - bot detection
- Reason:
  - Phase 5 needs durable click facts now without pulling in the later attribution, fraud, or optimization systems

## D-058: Click Metadata Privacy and Attribution Persistence Boundary

- Status: Approved
- This decision defines the long-term click-metadata persistence boundary for Meridian MVP hardening work

### IP storage strategy

- Long-term click persistence must use:
  - hashed IP only
- Raw IP is not approved for long-term durable click-fact storage
- Raw IP may exist transiently during request handling or in short-lived operational/security telemetry if needed for incident response, but it is not part of the approved durable click record boundary

### Query parameter strategy

- Long-term click persistence must use:
  - whitelist-based persistence
- Full raw query-string persistence is not approved for long-term durable click-fact storage
- Unknown query parameters must be ignored for long-term click storage unless explicitly approved later
- Unknown query parameters are rejected from durable persistence, not from public click intake itself
- Public click intake remains permissive at the query-string boundary so legacy traffic can continue flowing while Meridian persists only the approved whitelist

### Approved attribution parameter inventory

- The approved long-term persistence whitelist is:
  - `sub1`
  - `sub2`
  - `sub3`
  - `sub4`
  - `sub5`
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_content`
  - `utm_term`
- These parameters are approved because they support:
  - publisher attribution
  - campaign diagnostics
  - reporting joins that do not require free-form query persistence

### Exclusions

- The following are not approved for long-term click persistence in MVP:
  - arbitrary query strings
  - unknown free-form query parameters
  - secrets, tokens, or credentials passed on the query string
  - raw IP as part of durable click facts

### Phase boundary

- Phase 5.1 established the click-ingest foundation and currently captures broader request metadata
- Phase 5.2 must tighten that boundary to the approved long-term persistence model above

- Reason:
  - full query persistence and raw durable IP storage create unnecessary privacy and security exposure for MVP
  - a small attribution whitelist is sufficient for the approved tracking, conversion, payout, and reporting roadmap

## D-059: Conversion Attribution Architecture Baseline

- Status: Approved
- This decision freezes the minimum MVP conversion-attribution model before Phase 5.2 hardening and Phase 6 implementation

### Click-to-conversion relationship

- One click may legitimately produce many conversions
- Meridian MVP does not enforce a global one-click-to-one-conversion rule
- The same click may produce multiple conversions when:
  - multiple approved event types occur for the same offer
  - repeated occurrences of the same event type are legitimately emitted by the advertiser integration
- Conversion legitimacy is therefore determined by advertiser event identity and dedupe rules, not by a one-conversion-per-click cap

### Conversion identity strategy

- Conversions use backend-generated opaque immutable `cnv_*` public identifiers
- Conversion public IDs:
  - are generated server-side
  - are not authorization mechanisms
  - are never reused
- Internal database identifiers remain private implementation detail

### Duplicate conversion handling

- Duplicate protection must be advertiser-event-driven
- Every ingested conversion must carry an advertiser-scoped external event identifier or an equivalent idempotency key
- Replay protection rules:
  - the same advertiser-scoped external event identity must not create multiple finalized conversions
  - ingestion retries must resolve to the same conversion fact or an explicit duplicate outcome
- Duplicate handling is not based on organization, publisher, advertiser, or offer identifiers supplied by the caller as authority inputs

### Conversion lifecycle

- Minimum correct MVP lifecycle states:
  - `received`
  - `finalized`
  - `rejected`
- `received`
  - the conversion request has been accepted into Meridian and persisted for attribution processing
- `finalized`
  - attribution and financial snapshotting are complete
  - finalized conversion facts are stable and non-retroactive unless an explicit manual reprocess path is later invoked
- `rejected`
  - the conversion cannot be accepted as a valid attributable business fact because of validation, attribution, or duplicate rules

### Event-type behavior

- Approved MVP event-family review:
  - `lead`
  - `registration`
  - `install`
  - `deposit`
  - `sale`
  - `custom`
- A single click may legitimately produce multiple different event types
- A single click may also legitimately produce repeated events of the same event type when the advertiser integration model supports repeated event occurrences
- Meridian must therefore dedupe by advertiser event identity, not by click ID alone and not by event type alone

### Attribution ownership

- Conversion attribution derives only through the approved tracking chain:
  - tracking token
  - assignment
  - click
  - conversion
- Caller-supplied organization, publisher, advertiser, offer, or assignment identifiers must never be trusted as attribution authority
- Advertiser-facing conversion ingest may carry reference values for lookup, but Meridian must resolve attribution through approved tracking-derived click context rather than caller-declared tenant authority

### Conversion timestamp strategy

- Minimum correct MVP timestamp model:
  - `occurred_at`
  - `received_at`
  - `finalized_at`
- `occurred_at`
  - advertiser-reported business event time when available
- `received_at`
  - Meridian ingest receipt time
- `finalized_at`
  - the time Meridian locks attribution and financial outcomes
- `received_at` is mandatory
- `occurred_at` should be captured when supplied by the advertiser integration
- `finalized_at` is set only when the conversion reaches `finalized`

- Reason:
  - one-click-to-many-conversions is required for realistic advertiser event models
  - advertiser-scoped external event identity is the correct dedupe boundary
  - a minimal three-state lifecycle and three-timestamp model is enough for attribution, replay safety, payout snapshotting, and reporting without adding premature workflow complexity

## D-060: Conversion Intake Authority and Public Source Model

- Status: Approved
- This decision freezes which public conversion sources Meridian supports in MVP and how they relate to attribution authority

### Supported conversion sources

- Meridian MVP supports both:
  - advertiser-side postbacks
  - legacy or partner-facing public conversion callback endpoints
- Approved public callback endpoint surfaces:
  - `/gpixel`
  - `/goal`

### Attribution authority boundary

- Conversion source must never become attribution authority
- Attribution authority remains only:
  - tracking token
  - assignment
  - click
  - conversion
- `click_id` may be used as a direct lookup key where applicable, but only as a Meridian-issued tracking artifact inside the same attribution chain
- Caller-supplied organization, publisher, advertiser, offer, or assignment identifiers remain non-authoritative inputs

### Source-specific role

- Advertiser-side postbacks:
  - may submit advertiser event identity, event type, occurred time, and click-reference values required for lookup
  - do not directly declare final tenant or payout authority
- Legacy public callback endpoints:
  - may submit click-reference values or callback data required for lookup
  - do not directly declare final tenant or payout authority
- Both source families feed the same attribution pipeline and must converge on the same dedupe, lifecycle, snapshot, and replay rules

### Endpoint architecture

- `/gpixel` and `/goal` remain separate public endpoint surfaces in MVP
- They must be thin transport aliases over one shared conversion-ingestion service
- Shared conversion-ingestion service responsibilities:
  - source normalization
  - payload validation
  - advertiser-event identity or idempotency-key dedupe
  - click lookup
  - attribution resolution
  - lifecycle transitions
  - financial and visibility snapshotting when finalization occurs

- Reason:
  - Meridian needs to support both canonical advertiser postbacks and legacy public callback patterns in MVP
  - keeping `/gpixel` and `/goal` as separate public surfaces preserves compatibility with expected integration patterns
  - enforcing one shared ingestion service prevents source-specific attribution drift

## D-061: Conversion Ingestion Lookup, Event Identity, and Source Contracts

- Status: Approved
- This decision freezes the remaining Phase 6.1 conversion-ingestion architecture before implementation

### Conversion entry surfaces

- Meridian MVP keeps three public conversion-entry surfaces:
  - `POST /conversions/ingest`
  - `GET /gpixel`
  - `GET /goal`
- All three remain thin transport layers over one shared conversion-ingestion service

#### `POST /conversions/ingest`

- Intended source:
  - canonical advertiser-side S2S postbacks
- Minimum request contract:
  - advertiser credential or equivalent source-auth input
  - `event_type`
  - `external_event_id` or `idempotency_key`
  - optional `click_id`
  - optional click-reference inputs
  - optional `occurred_at`
- Responsibility:
  - accept structured advertiser-origin conversion notifications
  - normalize request data into the shared ingestion pipeline

#### `GET /gpixel`

- Intended source:
  - legacy or partner-origin public conversion callback pattern
- Minimum request contract:
  - `event_type`
  - `external_event_id` or `idempotency_key`
  - optional `click_id`
  - optional click-reference inputs
  - optional `occurred_at`
- Responsibility:
  - accept one approved callback shape
  - normalize request data into the shared ingestion pipeline

#### `GET /goal`

- Intended source:
  - legacy or partner-origin public conversion callback pattern
- Minimum request contract:
  - `event_type`
  - `external_event_id` or `idempotency_key`
  - optional `click_id`
  - optional click-reference inputs
  - optional `occurred_at`
- Responsibility:
  - accept one alternate approved callback shape
  - normalize request data into the shared ingestion pipeline

### Click lookup strategy

- Minimum correct MVP lookup chain:
  1. exact `click_id` lookup
  2. exact external click-reference lookup using the approved persisted subid values in priority order:
     - `sub1`
     - `sub2`
     - `sub3`
     - `sub4`
     - `sub5`
- `utm_*` fields are not attribution lookup keys in MVP
- Arbitrary query parameters are not attribution lookup keys in MVP
- If multiple lookup inputs are supplied:
  - the highest-priority available input is used for primary lookup
  - contradictory lower-priority inputs must produce a rejected attribution outcome rather than silent ambiguity

### Conversion event identity model

- Minimum request identity requirement:
  - every conversion request must include at least one of:
    - `external_event_id`
    - `idempotency_key`
- `external_event_id` is the preferred canonical event identity
- `idempotency_key` is the fallback identity when a source cannot provide a stable external event ID
- Both are not required simultaneously in MVP
- If both are provided:
  - `external_event_id` is the primary dedupe key
  - `idempotency_key` remains a supporting replay-safety value

### Dedupe boundary

- Dedupe uniqueness scope is advertiser-source-scoped event identity
- Minimum correct MVP dedupe rule:
  - one advertiser source may not create multiple finalized conversions for the same `external_event_id`
  - if no `external_event_id` exists, one advertiser source may not create multiple finalized conversions for the same `idempotency_key`
- Dedupe is not scoped by caller-supplied organization, publisher, offer, or assignment identifiers

### Event validation

- `event_type` is resolved against the explicit event definitions on the attributed offer
- `event_type` in conversion requests maps to offer `event_code`
- If `event_type` is not defined on the attributed offer:
  - the conversion is rejected
  - Meridian does not accept-and-ignore unknown event types

- Reason:
  - one shared ingestion service needs one consistent request floor
  - click lookup must prefer Meridian-native identifiers first and bounded attribution references second
  - advertiser-scoped event identity is the minimum stable dedupe boundary
  - unknown events must be rejected so payout, reporting, and reconciliation do not silently drift

## D-062: Conversion Failure Model, Timestamps, Snapshots, and RBAC

- Status: Approved
- This decision freezes the remaining failure handling, timestamp ownership, snapshot contents, and internal access model for MVP conversions

### Attribution failure behavior

- Invalid payload:
  - request is rejected at the transport-validation layer
  - no conversion record is persisted
- Duplicate event identity:
  - no new conversion record is created
  - the ingest flow returns an explicit duplicate outcome tied to the already known conversion fact
- Click not found:
  - persist rejected conversion
  - lifecycle state = `rejected`
- Unknown event type:
  - persist rejected conversion
  - lifecycle state = `rejected`
- Contradictory lookup inputs:
  - persist rejected conversion
  - lifecycle state = `rejected`

### Rejection reason inventory

- Minimum explicit rejection or failure code model:
  - `invalid_payload`
  - `duplicate_event`
  - `click_not_found`
  - `unknown_event_type`
  - `attribution_conflict`
- `invalid_payload` is a request failure code, not a persisted rejected-conversion code
- `duplicate_event` is a dedupe outcome code and does not require creation of a second rejected conversion row
- Persisted rejected conversions use:
  - `click_not_found`
  - `unknown_event_type`
  - `attribution_conflict`

### Timestamp ownership

- Minimum correct MVP timestamp ownership:
  - `received_at` is mandatory and server-owned
  - `occurred_at` is source-supplied and optional
  - `finalized_at` is server-owned and set only when the conversion reaches `finalized`
- If the source omits `occurred_at`:
  - leave `occurred_at` as `null`
  - do not silently replace it with `received_at`

### Finalized conversion snapshot contents

- Financial snapshot:
  - advertiser payout
  - publisher payout
  - payout source
  - publisher tier
- Visibility snapshot:
  - `conversion_visibility_percent`
  - conversion visibility outcome
  - postback eligibility outcome
- Postback snapshot:
  - `publisher_postback_percent`
  - `assignment_postback_percent`
  - `effective_postback_percent`
- Identity snapshot:
  - `offer_assignment_id`
  - `click_id`
  - `offer_id`
  - `publisher_id`
  - `advertiser_id`
  - `event_type`
- No additional MVP snapshot fields are required beyond this set before implementation

### Conversion RBAC

- Internal conversion reads are allowed to:
  - `owner`
  - `admin`
  - `manager`
  - `analyst`
- Internal conversion reads are denied to:
  - `viewer`

- Reason:
  - request-level invalid payloads should not create durable noise records
  - rejected but structurally valid conversions must persist for operations, support, and replay analysis
  - `occurred_at` must not be fabricated when the source does not provide it
  - finalized conversions need a full enough snapshot to keep payout and visibility history stable without depending on mutable configuration
  - conversion read access should match the existing click-read baseline for MVP

## D-063: Conversion Dedupe Uniqueness Scope and Lookup Ambiguity Rules

- Status: Approved
- This decision freezes the exact dedupe scope and ambiguous-lookup handling used by Phase 6.1 implementation

### Event-identity uniqueness scope

- Conversion dedupe is advertiser-scoped, not endpoint-scoped
- The same advertiser event delivered through different public conversion surfaces must still dedupe to one conversion fact
- Exact MVP dedupe rules:
  - if `external_event_id` is present, uniqueness scope is:
    - `advertiser_id + external_event_id`
  - if `external_event_id` is absent and `idempotency_key` is present, uniqueness scope is:
    - `advertiser_id + idempotency_key`
- `source_surface` does not widen the uniqueness scope
- `organization_id`, `offer_id`, `publisher_id`, and `assignment_id` are not dedupe-scope inputs

### Source-scoping input

- All three public conversion-entry surfaces require `advertiser_id` as the minimum source-scoping input in MVP
- `advertiser_id` is used to:
  - validate an active advertiser source
  - scope dedupe
  - narrow non-authoritative click-reference lookup
- `advertiser_id` remains non-authoritative for attribution ownership

### Lookup ambiguity rules

- If `click_id` is supplied:
  - it is the authoritative lookup input within the approved lookup chain
  - if it does not resolve to a click, lower-priority `sub1`-`sub5` lookup is not attempted
  - the conversion is rejected as `click_not_found`
- If `click_id` is supplied and resolves to a click for a different advertiser than the source-scoping advertiser, reject as `attribution_conflict`
- For `sub1`-`sub5` lookup:
  - an exact match must resolve to at most one click within the scoped advertiser
  - if more than one click matches the same lookup input, reject as `attribution_conflict`
- If a higher-priority lookup input resolves to a candidate click, any lower-priority supplied lookup input that contradicts that candidate causes `attribution_conflict`

- Reason:
  - dedupe must collapse repeated delivery of the same advertiser event even when it arrives through different public surfaces
  - advertiser-scoped lookup narrows ambiguity without turning advertiser input into attribution authority
  - ambiguous click resolution must reject rather than silently selecting the wrong attribution target

## D-064: Conversion Finalization Trigger and Transition Model

- Status: Approved
- Phase 6.2 uses:
  - `received`
  - immediate synchronous finalization
- Meridian MVP does not introduce background conversion finalization
- Simplest approved model:
  - conversion ingest creates or updates the durable conversion fact in the request path
  - when attribution, payout resolution, visibility evaluation, and postback evaluation all succeed, the same request finalizes the conversion immediately
- Automatic lifecycle transitions:
  - `received -> finalized`
  - `received -> rejected`
- Normal ingest flow does not perform:
  - `finalized -> rejected`
  - `rejected -> finalized`
- Manual reprocessing may perform:
  - `rejected -> finalized`
  - `finalized -> finalized` with snapshot replacement
- `finalized -> rejected` is excluded from MVP
- If manual reprocessing of a finalized conversion cannot produce a valid finalized result:
  - existing finalized financial truth remains unchanged
  - no downgrade to `rejected` occurs
- Reason:
  - synchronous finalization is the simplest correct MVP model
  - it avoids introducing a worker dependency and asynchronous state-management complexity before it is needed
  - preventing `finalized -> rejected` protects the financial lock point and avoids historical instability

## D-065: Finalized Conversion Snapshot and Payout Source Inventory

- Status: Approved
- Phase 6.2 finalization must freeze the full financial, visibility, and postback snapshot on the conversion record

### Financial snapshot

- Required finalized financial fields:
  - `advertiser_payout`
  - `publisher_payout`
  - `publisher_payout_source`
  - `publisher_tier`
  - `publisher_tier_percent`
  - `assignment_override_amount`
- `assignment_override_amount` is nullable and populated only when an assignment override was the effective publisher payout source
- `advertiser_payout` is always sourced from the resolved offer event definition

### Publisher payout resolution chain

- Frozen resolution order:
  1. assignment override
  2. publisher tier percentage
  3. advertiser event payout
- This means:
  - advertiser event payout establishes the base advertiser payout
  - if an event-scoped assignment override exists, publisher payout uses that fixed amount
  - otherwise publisher payout uses the resolved tier percentage applied to advertiser payout

### Publisher payout source inventory

- Minimum approved `publisher_payout_source` values:
  - `assignment_override`
  - `publisher_tier`
- `advertiser_event` is not a separate publisher payout source value in MVP because advertiser event payout is always the base input, not an alternate publisher payout path

### Visibility snapshot

- Required finalized visibility fields:
  - `conversion_visibility_percent`
  - `conversion_visible_to_publisher`
- Hidden conversions still participate in:
  - payouts
  - internal reporting
  - internal conversion reads
- Publisher-facing visibility suppression does not alter internal financial truth

### Postback snapshot

- Required finalized postback fields:
  - `publisher_postback_percent`
  - `assignment_postback_percent`
  - `effective_postback_percent`
  - `postback_eligible`
- Suppressed postbacks do not alter:
  - advertiser payout
  - publisher payout
  - payout source
  - any other internal financial truth

### Identity snapshot

- Required finalized identity fields:
  - `offer_assignment_id`
  - `click_id`
  - `offer_id`
  - `publisher_id`
  - `advertiser_id`
  - `event_type`
- No additional MVP snapshot fields are required before Phase 6.2 implementation

- Reason:
  - finalized conversions must carry enough immutable data to support later payouts, reporting, disputes, and operational review without recalculating from mutable configuration
  - separating publisher-facing suppression from internal financial truth keeps payout integrity intact

## D-066: Manual Conversion Reprocessing Boundary and Audit Rules

- Status: Approved
- Manual conversion reprocessing is allowed in MVP
- Approved manual reprocessing scope:
  - retry a previously rejected conversion after supporting data or configuration has been corrected
  - recompute a previously finalized conversion when an operator intentionally performs a payout-affecting reprocess

### Snapshot replacement rules

- `rejected -> finalized`
  - allowed only through explicit manual reprocessing
  - finalization writes the full finalized snapshot
- `finalized -> finalized`
  - allowed only through explicit manual reprocessing
  - current finalized snapshot values are overwritten in place with the new finalized snapshot
  - Meridian MVP does not retain a separate version row for every snapshot revision
  - historical before/after values are preserved through audit logs only
- `finalized -> rejected`
  - not allowed in MVP

### Operational boundaries

- Manual reprocessing is an internal operational action only
- Public conversion-entry surfaces never trigger manual reprocessing semantics
- Reprocessing must operate on one existing conversion at a time in MVP
- Bulk reprocessing is excluded from MVP

### Audit requirements

- The following actions require audit logging:
  - any manual conversion reprocessing attempt
  - any manual reprocessing that changes finalized financial snapshot values
  - any manual reprocessing that changes finalized visibility or postback snapshot values
  - snapshot replacement of an already finalized conversion
- Existing approved audit requirements remain in force for:
  - tier assignment changes
  - tier percentage changes
  - advertiser event payout changes
  - custom override changes
  - publisher postback percentage changes
  - assignment postback percentage changes

- Reason:
  - manual reprocessing is necessary for controlled operational recovery
  - keeping it explicit, audited, and one-record-at-a-time preserves traceability without introducing a workflow engine

## D-067: Payout Entity Model and Conversion Granularity

- Status: Approved
- MVP payout structure is:
  - one `PayoutBatch` owns many `Payout` rows
  - payout rows are conversion-granular, not aggregated
- One finalized conversion produces at most one payout row
- One payout row represents exactly one finalized conversion
- One payout row may not summarize multiple conversions in MVP
- Rejected conversions may not produce payout rows
- Non-finalized conversions may not produce payout rows
- Payout rows are immutable once created
- Payout rows survive approval, export, and reconciliation unchanged
- Reason:
  - conversion-granular payout rows are the minimum safe structure for duplicate-payment protection, dispute review, and later adjustment handling

## D-068: Payout Batch Lifecycle, Creation Workflow, and Snapshot Boundary

- Status: Approved
- Minimum payout batch lifecycle states:
  - `draft`
  - `approved`
  - `exported`
  - `reconciled`
- Allowed forward lifecycle:
  - `draft -> approved`
  - `approved -> exported`
  - `exported -> reconciled`
- Forbidden lifecycle:
  - no backward transitions
  - no direct `draft -> exported`
  - no direct `draft -> reconciled`
  - no direct `approved -> reconciled`
- Draft batches are the only pre-commit operational state
- Draft batches may be deleted before approval
  - deleting a draft batch deletes its payout rows and releases those conversions for future rebatching
- Approved batches are locked
- Exported batches are locked
- Reconciled batches are permanently locked
- MVP batch creation workflow is:
  1. manual preview
  2. manual batch creation
  3. approval
  4. export
  5. reconciliation
- Scheduled or automatic batch creation is excluded from MVP
- Preview does not persist data
- Batch creation persists the batch and payout rows atomically

### Mandatory payout-row snapshot fields

- Identity:
  - `payout_id`
  - `batch_id`
  - `conversion_id`
  - `click_id`
  - `offer_id`
  - `offer_assignment_id`
  - `publisher_id`
  - `advertiser_id`
- Financial:
  - `advertiser_payout`
  - `publisher_payout`
  - `publisher_payout_source`
  - `publisher_tier`
  - `publisher_tier_percent`
  - `assignment_override_amount`
- Conversion facts:
  - `event_type`
  - `source_surface`
  - `finalized_at`
- No additional payout-row snapshot fields are required before Phase 7.1 implementation
- Reason:
  - payout rows must remain financially and operationally stable after conversion finalization, export, and reconciliation

## D-069: Payout Safety Boundary and Interaction with Conversion Reprocessing

- Status: Approved
- Duplicate-payment safety requires:
  - one finalized conversion may belong to zero or exactly one payout row
  - one finalized conversion may appear in at most one persisted payout row
  - one payout row belongs to exactly one payout batch
  - duplicate batch creation must exclude conversions already represented by persisted payout rows
- Minimum uniqueness boundary:
  - one live payout row per `conversion_id`
  - this boundary must be enforced by a database-level uniqueness constraint on `payouts.conversion_id`
- Conversion reprocessing behavior by payout state:
  - conversion not in any payout batch:
    - reprocessing allowed
    - future payout values follow the latest finalized conversion snapshot
  - conversion in a draft batch:
    - reprocessing blocked
    - operator must delete the draft batch first if they need to rerun the conversion before payment
  - conversion in an approved batch:
    - reprocessing blocked
    - future manual payout adjustment flow is required instead
  - conversion in an exported batch:
    - reprocessing blocked
    - future manual payout adjustment flow is required instead
  - conversion in a reconciled batch:
    - reprocessing blocked
    - future manual payout adjustment flow is required instead
- Rejected conversions may not appear in payout batches
- Non-finalized conversions may not appear in payout batches
- Phase 7.1 implementation enforces this with:
  - a database-level unique constraint on `payouts.conversion_id`
  - manual conversion reprocessing blocked whenever any persisted payout row already exists for the conversion
- Reason:
  - once a payout row exists, Meridian must treat that conversion as financially reserved or paid rather than allowing silent payout mutation through conversion reprocessing

## D-070: Payout Export, Reconciliation, RBAC, Audit, and Historical Immutability

- Status: Approved
- Export does not change financial truth
- Export is an operational status transition only
- Repeated export attempts are allowed as idempotent operational actions
  - they may regenerate the same export output from immutable batch rows
  - they do not create new payout rows
- Export files themselves are not persisted in MVP
- Reconciliation model in MVP is:
  - full-batch only
  - no partial reconciliation
  - no payout reversals
  - no negative payouts
  - no accounting ledger or balance engine
- Manual payout adjustments are deferred to the later adjustment flow and must not overwrite historical payout rows

### RBAC

- `owner`
  - payout reads: allowed
  - batch creation: allowed
  - approval: allowed
  - export: allowed
  - reconciliation: allowed
- `admin`
  - payout reads: allowed
  - batch creation: allowed
  - approval: allowed
  - export: allowed
  - reconciliation: allowed
- `manager`
  - payout reads: allowed
  - batch creation: denied
  - approval: denied
  - export: denied
  - reconciliation: denied
- `analyst`
  - payout reads: allowed
  - batch creation: denied
  - approval: denied
  - export: denied
  - reconciliation: denied
- `viewer`
  - payout reads: denied
  - batch creation: denied
  - approval: denied
  - export: denied
  - reconciliation: denied

### Audit requirements

- The following actions require audit logging:
  - payout batch preview is excluded because it does not persist state
  - batch creation
  - draft batch deletion
  - batch approval
  - batch export
  - batch reconciliation
  - manual payout adjustments when implemented
  - any operation that changes persisted payout history

### Historical immutability

- MVP chooses:
  - preserve payout rows permanently once a batch is approved
  - do not overwrite payout rows
  - use later adjustment mechanisms rather than row mutation
- Draft batches may be deleted before approval because they are not yet committed payout history
- Phase 7.1 implementation includes:
  - draft batch deletion
  - approval, export, and reconciliation status transitions
  - audit logging for batch creation, draft deletion, approval, export, and reconciliation
- Reason:
  - preserving approved and later batch rows is the simplest architecture that keeps payment history auditable and avoids silent financial rewrites
