# Meridian TODO

## Phase 0 - Project Foundation

### 0.0 Repository Initialization

- [x] Read `AGENTS.md`
- [x] Initialize git repository
- [x] Create approved top-level folder structure
- [x] Create missing state files
- [x] Capture initial project context and architecture decisions

### 0.1 Workspace Bootstrap

- [x] Define root workspace and package manager strategy
- [x] Create root package manifest and workspace configuration
- [x] Create shared TypeScript baseline configuration
- [x] Create shared linting and formatting baseline
- [x] Create environment variable strategy for local, development, staging, and production

### 0.2 Runtime Skeleton

- [x] Create `apps/web` runtime skeleton as Next.js presentation layer only
- [x] Create `apps/api` runtime skeleton as Node.js business API
- [x] Create `apps/worker` runtime skeleton for async processing
- [x] Define shared contracts package structure
- [x] Define shared logging and error-handling conventions

### 0.3 Delivery Baseline

- [x] Define test runner strategy across apps and shared packages
- [x] Define CI validation stages
- [x] Define deployment stage expectations for web, api, and worker
- [x] Define health and readiness endpoint contract entries
- [x] Define repository bootstrap verification checklist

## Phase 1 - Authentication and Organizations

### 1.1 Auth Core

- [x] Define auth request and response contracts in `API_CONTRACT.md`
- [x] Implement user signup flow
- [x] Implement email verification flow
- [x] Implement login and logout flow
- [x] Implement password reset request and completion flow
- [x] Add auth unit and integration tests

### 1.2 Organization Onboarding

- [x] Define organization onboarding contracts in `API_CONTRACT.md`
- [x] Implement organization creation flow
- [x] Implement organization listing and selection flow
- [x] Implement active organization resolution in API session context
- [x] Implement onboarding UI flow in `apps/web`
- [x] Add onboarding integration and E2E coverage

## Phase 2 - User Management and RBAC

### 2.1 Membership and Roles

- [x] Define membership and role contracts in `API_CONTRACT.md`
- [x] Implement membership model and role checks
- [x] Implement member list and member detail endpoints
- [x] Implement role update and membership deactivate flows
- [x] Implement team management UI
- [x] Add RBAC integration and security tests

### 2.2 Admin-Provisioned Work Accounts and Team Administration

- [x] Redesign Phase 2.2 contract away from invites and toward direct employee account provisioning
- [x] Define owner/admin employee account creation rules in `API_CONTRACT.md`
- [x] Define first-login password-reset enforcement for admin-created work accounts
- [x] Define manager assignment rules for employee creation and reassignment
- [x] Define user removal from a manager's team
- [x] Add unauthorized access regression tests for account provisioning and team assignment flows

### 2.3 Executive Assignment Visibility Review

- [x] Withdraw campaign-level visibility restrictions from MVP
- [x] Remove single-viewer offer visibility from the active MVP backlog
- [ ] Future V2 only: define many-to-many `offer_visibility_assignments` if executive-specific campaign visibility is later approved

## Phase 3 - Publisher and Advertiser Management

### 3.1 Publisher Records

- [x] Define publisher contracts in `API_CONTRACT.md`
- [x] Implement publisher create, list, detail, update, archive, and restore
- [x] Implement publisher list and form screens
- [x] Add publisher validation and tenant-isolation tests

### 3.2 Advertiser Records

- [x] Define advertiser contracts in `API_CONTRACT.md`
- [x] Implement advertiser create, list, detail, update, archive, and restore
- [x] Implement advertiser list and form screens
- [x] Add advertiser validation and tenant-isolation tests

## Phase 4 - Offer Management

### 4.1 Offer Core

- [x] Define offer contracts in `API_CONTRACT.md`
- [x] Implement mandatory `Offer -> AdvertiserRecord` ownership and advertiser-scoped offer uniqueness
- [x] Implement advertiser-specific offer event definitions for MVP conversion types
- [x] Implement explicit offer-defined custom events with unique per-offer `event_code`
- [x] Keep `tracking_slug` informational only and non-authoritative for attribution
- [x] Implement offer create, list, detail, update, activate, pause, resume, archive, and restore
- [x] Implement offer management UI
- [x] Add offer validation, tenant-isolation, contract, integration, security, and E2E coverage

### 4.2 Offer Assignment and Controls

- [x] Define offer-assignment contracts in `API_CONTRACT.md`
- [x] Implement offer assignment create, list, detail, update, archive, restore, pause, and resume
- [x] Enforce one non-archived assignment per `Offer + Publisher` pair
- [x] Reserve `OfferAssignment` as the sole tracking authority by generating assignment-owned opaque tracking links
- [x] Remove withdrawn MVP viewer-specific offer visibility from implemented offers and offer-assignment reads
- [x] Implement publisher tier assignment and organization-configurable tier percentage support
- [x] Implement publisher-level `publisher_postback_percent` on `PublisherRecord` with owner/admin-only edit permissions
- [x] Implement event-scoped custom publisher payout overrides with frozen resolution order
- [x] Implement assignment-level conversion visibility and postback percentage controls
- [x] Resolve effective postback percent as `MIN(publisher_postback_percent, assignment postback_percent)`
- [x] Implement tracking-link generation
- [x] Implement assignment screens and linking UI
- [x] Add assignment validation and publisher-linkage tests

## Phase 5 - Tracking Infrastructure

### 5.1 Click Ingestion

- [x] Define tracking contracts in `API_CONTRACT.md`
- [x] Harden assignment tracking-token handling for public click ingest while keeping tracking tokens separate from public record IDs
- [x] Implement public click ingestion and redirect handling through assignment-owned tracking tokens
- [x] Implement click persistence and request correlation
- [x] Implement internal click list and detail reads
- [x] Add click ingestion integration and security tests

### 5.2 Tracking Hardening

- [x] Implement tracking validation and malformed request handling
- [x] Replace durable raw IP storage with approved hashed-IP persistence boundary
- [x] Replace durable raw query persistence with approved attribution-parameter whitelist
- [x] Persist only approved attribution parameters: `sub1`-`sub5` and `utm_*`
- [ ] Implement rate-limiting or abuse-control hooks for public click routes
- [ ] Implement tracking diagnostics and operational logging conventions
- [x] Keep click persistence aligned with the frozen conversion-attribution chain: tracking token -> assignment -> click -> conversion
- [x] Add tracking regression coverage

## Phase 6 - Conversion Processing

### 6.1 Conversion Intake

- [x] Define conversion contracts in `API_CONTRACT.md`
- [x] Freeze public conversion source support for advertiser postbacks plus legacy public `/gpixel` and `/goal`
- [x] Freeze the minimum click lookup chain and conversion event-identity boundary
- [x] Freeze the minimum rejection reason inventory and timestamp ownership model
- [x] Freeze advertiser-scoped dedupe uniqueness and ambiguous lookup rejection rules
- [x] Implement public conversion ingest endpoint
- [x] Implement `/gpixel` and `/goal` as thin public aliases over one shared conversion-ingestion service
- [x] Implement advertiser source validation for conversion ingest
- [x] Implement conversion persistence and status model
- [x] Enforce advertiser-scoped external event identity or idempotency-key dedupe
- [x] Persist `received_at` and advertiser-supplied `occurred_at` where available
- [x] Add conversion intake integration and security tests

### 6.2 Attribution and Reprocessing

- [x] Implement click-to-conversion attribution flow
- [x] Implement conversion dedupe and idempotency rules
- [x] Support one-click-to-many-conversions where advertiser event identity permits it
- [x] Keep conversion source non-authoritative and resolve attribution only through tracking token -> assignment -> click -> conversion, or `click_id` where applicable
- [x] Persist rejected conversions for `click_not_found`, `unknown_event_type`, and `attribution_conflict`
- [x] Implement immediate synchronous finalization in the ingest path
- [x] Snapshot finalized advertiser payout, publisher payout, publisher payout source, publisher tier, publisher tier percent, and nullable assignment override amount
- [x] Snapshot finalized conversion visibility percent and publisher-visibility outcome
- [x] Snapshot finalized publisher postback percent, assignment postback percent, effective postback percent, and postback eligibility outcome
- [x] Snapshot finalized conversion identity set: `offer_assignment_id`, `click_id`, `offer_id`, `publisher_id`, `advertiser_id`, `event_type`
- [x] Persist finalized immutable source diagnostics: `external_event_id`, `idempotency_key`, and `source_surface`
- [x] Set `finalized_at` only when attribution and financial outcomes are locked
- [x] Implement manual conversion reprocess endpoint with one-record-at-a-time operational boundaries
- [x] Preserve manual finalized-to-finalized history through audit logs while overwriting the current snapshot in place
- [ ] Implement conversion management UI
- [ ] Add golden-data tests for attribution and payout behavior

## Phase 7 - Payout System

### 7.1 Payout Calculation

- [x] Freeze payout entity, lifecycle, duplicate-payment, and immutability architecture
- [x] Freeze payout interaction rules with manual conversion reprocessing
- [x] Freeze zero-or-one payout-row-per-finalized-conversion safety boundary with database-level uniqueness
- [x] Define payout contracts in `API_CONTRACT.md`
- [x] Implement payout batch preview and creation
- [x] Implement payout line-item calculation
- [x] Implement payout list and detail reads
- [x] Add payout calculation integration coverage
- [ ] Add payout golden-data tests

### 7.2 Approval, Export, and Reconciliation

- [x] Implement payout batch approval flow
- [x] Implement payout export flow
- [x] Implement payout reconciliation flow
- [ ] Implement payout adjustment flow
- [ ] Implement payout management UI
- [x] Add finance workflow regression tests

## Phase 8 - Reporting System

### 8.1 Reporting Read Models

- [ ] Define reporting contracts in `API_CONTRACT.md`
- [ ] Implement reporting aggregates and read models
- [ ] Implement summary, performance, conversions, and payouts report endpoints
- [ ] Add report aggregation validation and golden-data tests

### 8.2 Reporting UI and Exports

- [ ] Implement reporting dashboard and drilldown screens
- [ ] Implement report filter and sorting UI
- [ ] Implement report export request and status flow
- [ ] Add reporting export and performance tests

## Phase 9 - Billing and Entitlements

### 9.1 Subscription State

- [ ] Define billing contracts in `API_CONTRACT.md`
- [ ] Implement subscription read and update flows
- [ ] Implement plan catalog exposure
- [ ] Implement billing views in `apps/web`
- [ ] Add billing integration tests

### 9.2 Entitlements and Usage

- [ ] Implement entitlement evaluation
- [ ] Implement usage reporting endpoints
- [ ] Implement server-side feature gating hooks
- [ ] Implement billing usage UI
- [ ] Add entitlement and plan-limit tests

## Phase 10 - Audit and Security

### 10.1 Audit Trail

- [ ] Define audit contracts in `API_CONTRACT.md`
- [ ] Implement audit record writes for sensitive actions
- [ ] Add audit coverage for tier changes, advertiser event payout changes, custom override changes, and payout-affecting reprocessing
- [x] Add audit coverage for manual conversion reprocessing attempts and finalized snapshot replacements
- [ ] Implement audit log list and detail reads
- [ ] Implement audit log UI
- [ ] Add audit coverage tests

### 10.2 Security Hardening

- [ ] Implement session hardening and revocation policies
- [ ] Implement auth and public-route rate limiting
- [ ] Implement security logging conventions
- [ ] Add tenant-isolation regression tests
- [ ] Add security test coverage for auth, tracking, and billing paths

## Phase 11 - Admin and Operations

### 11.1 Internal Operations

- [ ] Define internal admin and operations requirements
- [ ] Implement internal lookup and operational support endpoints
- [ ] Implement admin and operations UI surfaces
- [ ] Add privileged-access audit coverage

## Phase 12 - Production Readiness

### 12.1 Release Readiness

- [ ] Finalize CI validation gates
- [ ] Finalize deployment and rollback procedures
- [ ] Finalize backup and restore verification steps
- [ ] Finalize monitoring and alerting expectations
- [x] Configure Netlify frontend and Railway API deployment settings
- [x] Configure production CORS allowlist for `meridian.rovminds.com` and `track.meridian.rovminds.com`
- [ ] Run end-to-end bootstrap and staging verification checklist

## State File Discipline

- [ ] Keep `PROJECT_CONTEXT.md` aligned with implementation state
- [ ] Keep `DECISIONS.md` aligned with approved tradeoffs
- [ ] Keep `API_CONTRACT.md` aligned with approved API design
- [ ] Keep `TODO.md` aligned with real execution status

## Frontend Tooling Follow-Up

- [ ] Resolve the Next.js ESLint plugin warning before substantial frontend development begins

## Approval Gate

- [x] Receive approval before starting Phase 0.2 runtime skeleton work
- [x] Receive approval before starting Phase 0.3 delivery baseline work
- [x] Receive review approval before starting Phase 1 implementation
- [x] Receive review approval before starting Phase 1.2 organization onboarding work
- [x] Receive review approval before starting Phase 2.1 membership and RBAC work
- [x] Receive review approval before starting redesigned Phase 2.2 work-account provisioning and team administration work
