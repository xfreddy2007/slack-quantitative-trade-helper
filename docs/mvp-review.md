# MVP Review — Slack Quantitative Trade Helper

_Final pre-Milestone-9 review (T8.2.2). Reviewer: engineering. Date: 2026-06-20._

This review gates the MVP before Milestone 9 (broker integration) begins. The automated
acceptance check is `npm run quality-gate` (see [README](../README.md#quality-gate)); this
document covers what that script cannot assert: security posture, test coverage, and deployment
readiness.

---

## 1. Security

| Area | Finding | Status |
|---|---|---|
| Secrets in source | No hardcoded API keys/tokens/passwords (ripgrep scan of `apps/`, `research/`). All secrets read from env via a Zod schema (`apps/slack-bot/src/config/index.ts`) and Pydantic settings (`research/quant-python/.../config/settings.py`). | ✅ |
| `.env` handling | `.env`, `.env.local`, `.env.*` are gitignored; only `.env.example` (placeholder values) is tracked. | ✅ |
| SQL injection | Python DB layer (`db/writer.py`) uses psycopg2 parameterized queries (`%s`); no f-string/`+` SQL interpolation. TypeScript uses the Prisma client (parameterized). | ✅ |
| Slack request auth | The bot runs Bolt in **Socket Mode** (`socketMode: true`), authenticated via `SLACK_APP_TOKEN` over a WebSocket — there is no inbound HTTP endpoint, so HTTP signing-secret verification does not apply. If an HTTP Events receiver is added later, restore signing-secret + timestamp-replay checks. | ✅ (N/A by design) |
| Provider failure isolation | External provider calls run inside `runIsolated` (T6.2.1); network/API/rate-limit/auth failures are recorded to `provider_runs` and never crash the bot or command handlers. | ✅ |
| Paper-only safety | Recommendations are advisory; no broker orders are placed in the MVP. The daily render carries a paper-only disclaimer. | ✅ |

No blocking security findings.

---

## 2. Test Coverage

Measured 2026-06-20 against a fresh Postgres (`:5433`).

| Suite | Metric | Target | Measured | Status |
|---|---|---|---|---|
| TypeScript (Vitest) | line coverage | > 70% | **79.45%** (branch 85.7%, funcs 93.3%) | ✅ |
| Python library (pytest-cov) | line coverage | > 80% | **98%** | ✅ |
| Python incl. CLI entrypoints | line coverage | — | 73% | ℹ️ |

- Totals: 304 TS tests (39 files) + 74 Python tests, all passing.
- The Python figure excludes `jobs/*` (configured in `pyproject.toml`
  `[tool.coverage.run] omit`). Those modules are thin CLI entrypoints
  (`generate_daily_recommendations`, `evaluate_paper_recommendations`) exercised end-to-end by the
  fixture pipeline and e2e Groups 5/8/12 rather than by unit tests. Including them the raw figure
  is 73%; the library logic (allocation, drift, rebalance, event adjustment, evaluation, models) is
  at 98%.
- TS coverage provider: `@vitest/coverage-v8`. Run with `npm --prefix apps/slack-bot run test -- --coverage`.

No blocking coverage findings: both stated targets are met.

---

## 3. Deployment Readiness

| Item | Artifact | Status |
|---|---|---|
| PostgreSQL (Neon) provisioning | `docs/runbooks/neon-setup.md` | ✅ documented |
| Postgres provider migration runbook | `docs/runbooks/postgres-provider-migration.md` | ✅ documented |
| Fly.io app configs | `fly.slack.toml`, `research/quant-python/fly.research.toml` | ✅ created |
| Container images | `apps/slack-bot/Dockerfile`, `research/quant-python/Dockerfile` (multi-stage) | ✅ |
| Fly deployment + smoke test runbook | `docs/runbooks/fly-deployment.md` (includes secrets set + dry-run startup smoke test) | ✅ documented |
| Prisma migrations | `db/prisma/migrations/` apply cleanly via `prisma migrate deploy` | ✅ |
| CI acceptance gate | `npm run quality-gate` (this task) | ✅ |

Smoke test: the bot supports `--dry-run` (startup/config validation without connecting to Slack),
documented in `fly-deployment.md` and covered by `tests/unit/index.test.ts`.

No blocking deployment findings.

---

## 4. Blocking findings

**None.** All security, coverage, and deployment criteria are met or resolved above.

### Non-blocking follow-ups (tracked, not MVP blockers)

1. **Live provider ingestion not wired into the running bot.** The market-aware scheduler
   (T6.2.1) and the FinMind/TWSE/TPEX adapters + provider chain (T7.1.1/T7.2.1) ship as tested
   units but are not started from the compiled `main()` — `tsconfig.build.json` excludes
   `providers/`/`orchestration/` from the dist build (tsx-only). Wiring requires a build-config
   change; deferred to the live-ingestion epic.
2. **Allocation-discipline scoring not wired into the evaluation job.** `score_discipline`
   (T8.1.1) is a tested standalone function; wiring it into the job needs allocation snapshots at
   recommendation and horizon time (allocation history).

These are intentional scope boundaries recorded in the respective task notes; they do not block the
MVP acceptance gate.
