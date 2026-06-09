# Meridian Delivery Baseline

## CI Stages

- install dependencies
- lint
- typecheck
- build
- integration tests
- contract tests

## Deployment Expectations

- `web`
  - deploys as the Next.js presentation layer
  - must only communicate with the Node API through approved contracts
- `api`
  - deploys as the business API runtime
  - owns `health` and `ready` operational checks
- `worker`
  - deploys independently from the API
  - runs async processing without hosting customer-facing routes

## Environment Promotion

- local
- development
- staging
- production

## Release Rule

- no Phase 0 bootstrap release is considered healthy unless lint, typecheck, build, and bootstrap operational tests pass
