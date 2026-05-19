# Tasks — MVP Launch

## Epic: Fixture-First Investment Helper MVP

Detailed stable task IDs live in root `DEVELOPMENT_SCHEDULE.md`. This file is the formal PM task tracker for the MVP launch epic.

### Task 1: Repo Hygiene and Local Foundations
**Priority:** P0
**Definition of Done:** Phase 0 tasks T-0001 through T-0005 are complete, and local TypeScript, Python, and PostgreSQL commands are documented or runnable.

- [ ] Create root README with project purpose, stack, setup outline, and links to planning docs.
- [ ] Add `.gitignore` for secrets, personal portfolio files, user wiki outputs, alert logs, Node artifacts, Python artifacts, coverage, and local DB data.
- [ ] Create monorepo folder skeleton.
- [ ] Add local Docker Compose PostgreSQL.
- [ ] Add root command strategy for tests, migrations, and fixture seeding.

### Task 2: Database and Shared Schemas
**Priority:** P0
**Definition of Done:** Phase 1 tasks T-0101 through T-0106 are complete, Prisma validates/migrates, seed fixtures load idempotently, and shared schemas import successfully.

- [ ] Initialize TypeScript Slack app package.
- [ ] Initialize uv-managed Python research package.
- [ ] Create Prisma schema v1.
- [ ] Add local database migration.
- [ ] Add shared JSON/Zod schema directory.
- [ ] Add seed fixture database script.

### Task 3: Fixture Assets
**Priority:** P0
**Definition of Done:** Phase 2 fixture tasks T-0201 through T-0204 are complete, and all fixtures validate through tests.

- [ ] Create portfolio fixtures.
- [ ] Create price snapshot fixtures.
- [ ] Create news fixtures.
- [ ] Create provider payload fixtures.

### Task 4: TypeScript App Shell
**Priority:** P0
**Definition of Done:** Phase 3 TypeScript tasks T-0301 through T-0306 are complete, with config, DB wrapper, fixture loader, provider interface, renderer, and command router tests passing.

- [ ] Implement environment config validation.
- [ ] Implement Prisma client wrapper.
- [ ] Implement fixture loader.
- [ ] Implement provider adapter interface.
- [ ] Implement Slack renderer skeleton.
- [ ] Implement Slack command router skeleton.

### Task 5: Python Quant Core
**Priority:** P0
**Definition of Done:** Phase 4 Python tasks T-0401 through T-0408 are complete, and Python can generate daily and paper recommendations from fixture input.

- [ ] Implement Python config loader.
- [ ] Implement portfolio models.
- [ ] Implement allocation calculation.
- [ ] Implement drift detection.
- [ ] Implement routine rebalancing recommendation.
- [ ] Implement event-aware risk adjustment.
- [ ] Implement paper recommendation writer.
- [ ] Implement daily recommendation job.

### Task 6: Source Ingestion and Wiki
**Priority:** P0
**Definition of Done:** Phase 5 tasks T-0501 through T-0506 are complete, and fixture news creates raw records, wiki pages, index/log entries, market classifications, and duplicate suppression results.

- [ ] Implement source repository.
- [ ] Implement raw source writer.
- [ ] Implement wiki summary writer.
- [ ] Implement wiki index and log updater.
- [ ] Implement market classification.
- [ ] Implement duplicate news detection.

### Task 7: Trigger and Recommendation Integration
**Priority:** P0
**Definition of Done:** Phase 6 tasks T-0601 through T-0606 are complete, and the fixture E2E flow creates a Slack-ready daily recommendation and paper recommendation.

- [ ] Implement trigger scoring.
- [ ] Implement alert threshold logic.
- [ ] Implement daily alert budget.
- [ ] Persist trigger evaluations.
- [ ] Build E2E fixture recommendation pipeline.
- [ ] Render E2E Slack recommendation.

### Task 8: Slack MVP
**Priority:** P0
**Definition of Done:** Slack Socket Mode entrypoint and all PRD MVP commands are implemented or explicitly tracked, with handler tests and local Slack smoke test documentation.

- [ ] Implement `/investment status`.
- [ ] Implement `/investment portfolio`.
- [ ] Implement `/investment brief today`.
- [ ] Implement `/investment brief tw`.
- [ ] Implement `/investment brief us`.
- [ ] Implement `/investment recommendation today`.
- [ ] Implement `/investment paper-log`.
- [ ] Implement `/investment explain <alert_id>`.
- [ ] Implement `/investment mute <ticker|topic>`.
- [ ] Implement `/investment feedback <alert_id> useful|not_useful|too_noisy|too_late`.
- [ ] Wire Slack Socket Mode entrypoint.

### Task 9: Deployment MVP
**Priority:** P1
**Definition of Done:** Phase 8 tasks T-0801 through T-0807 are complete, Fly.io workers connect to Neon, and manual recommendation smoke test is documented.

- [ ] Add TypeScript Dockerfile.
- [ ] Add Python Dockerfile.
- [ ] Add Fly.io app config for Slack worker.
- [ ] Add Fly.io app config for Python worker.
- [ ] Document Neon setup.
- [ ] Document Fly deployment.
- [ ] Add DigitalOcean PostgreSQL migration runbook.

### Task 10: Provider Experiments
**Priority:** P1
**Definition of Done:** Phase 9 tasks T-0901 through T-0904 are complete, provider adapters are feature-flagged or replaceable, and provider failures do not break Slack commands.

- [ ] Implement Alpha Vantage adapter skeleton.
- [ ] Add Alpha Vantage rate limit guard.
- [ ] Implement provider failure isolation.
- [ ] Add Twinkle Hub context boundary.

### Task 11: Evaluation and Hardening
**Priority:** P0
**Definition of Done:** Phase 10 tasks T-1001 through T-1007 are complete, paper recommendations can be evaluated, and final MVP review has no unresolved blocking findings.

- [ ] Implement 5-day return evaluation.
- [ ] Implement volatility and drawdown note.
- [ ] Implement allocation discipline score.
- [ ] Persist paper evaluation.
- [ ] Extend `/investment paper-log` with evaluation.
- [ ] Add E2E quality gate script.
- [ ] Complete final MVP review.
