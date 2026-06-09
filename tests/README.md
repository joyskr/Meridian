# Meridian Test Strategy

## Scope

- The repository now includes coverage for bootstrap, auth, organization onboarding, and membership RBAC
- Higher-phase business modules remain deferred

## Test Layers

- `tests/integration`
  - cross-module runtime checks
  - current focus: API operational routes, auth lifecycle behavior, organization onboarding, and membership flows
- `tests/contract`
  - response-shape and contract conformance checks
  - current focus: `GET /health`, `GET /ready`, auth contracts, organization contracts, and membership contracts
- `tests/unit`
  - direct service-layer verification
  - current focus: auth, organization, and membership service behavior against a Postgres-compatible in-memory runtime
- `tests/e2e`
  - full end-to-end flows at the API boundary
  - current focus: authenticated organization onboarding and team management
- `tests/golden`
  - reporting, conversion, and payout fixture-driven checks
  - not yet implemented in Phase 0.3
- `tests/security`
  - auth, RBAC, tenant-isolation, and public endpoint abuse checks
  - current focus: RBAC restrictions and team-management boundaries

## Commands

- `npm run test:integration`
- `npm run test:contract`
- `npm run test:security`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run verify:bootstrap`

## Current Minimum Coverage

- API operational endpoints must have integration and contract coverage
- Auth core must have unit, integration, and contract coverage
- Organization onboarding must have unit, integration, contract, and end-to-end coverage
- Membership RBAC must have unit, integration, contract, security, and end-to-end coverage
- Root lint, typecheck, and build must pass before a completed phase is considered done
