# E2E Test Configuration: investment-helper

## Project Info

- **Project**: investment-helper
- **Root**: /Users/xfreddy2007/Documents/Self-projects/investment-helper
- **Stack**: TypeScript (apps/slack-bot) + Python (research/quant-python)
- **Database**: PostgreSQL via Docker Compose
- **TS test framework**: Vitest (`npm test` from `apps/slack-bot/`)
- **Python test framework**: pytest (`uv run pytest` from `research/quant-python/`)
- **Slack mode**: Socket Mode (mock client in tests, live in smoke test)

---

## Prerequisites

Run each check. Abort if any fails.

```bash
docker --version         # Docker installed and daemon running
node --version           # Node.js available (via nvm)
uv --version             # uv available for Python
npx --version            # npx available
```

Check docker daemon:

```bash
docker info > /dev/null 2>&1 && echo "DOCKER_DAEMON_OK" || echo "DOCKER_DAEMON_DOWN"
```

Check root `.env` exists (required for DB URL and Slack tokens in integration tests):

```bash
test -f /Users/xfreddy2007/Documents/Self-projects/investment-helper/.env && echo "ENV_OK" || echo "ENV_MISSING"
```

If `.env` is missing → warn but do not abort. Integration tests that need DB will fail and
identify the root cause.

---

## Infrastructure Setup

Execute in order. Abort if any step fails.

### S1 — Tear down existing containers

```bash
docker compose -f /Users/xfreddy2007/Documents/Self-projects/investment-helper/docker-compose.yml down -v 2>&1
```

### S2 — Start PostgreSQL

```bash
docker compose -f /Users/xfreddy2007/Documents/Self-projects/investment-helper/docker-compose.yml up -d postgres 2>&1
```

### S3 — Wait for healthy (60 second timeout)

```bash
timeout 60 bash -c '
  until docker compose \
    -f /Users/xfreddy2007/Documents/Self-projects/investment-helper/docker-compose.yml \
    ps postgres 2>/dev/null | grep -qE "(healthy|\(healthy\))"; do
    sleep 2
  done
' && echo "POSTGRES_HEALTHY" || echo "POSTGRES_TIMEOUT"
```

If `POSTGRES_TIMEOUT` → abort: ❌ PostgreSQL did not become healthy within 60 s.

### S4 — Apply Prisma migrations

**Requires: PHASE1_SCHEMA active**

```bash
cd /Users/xfreddy2007/Documents/Self-projects/investment-helper && \
  npx prisma migrate deploy --schema db/prisma/schema.prisma 2>&1
```

Abort if exit code non-zero: ❌ Prisma migrations failed. Fix schema before running tests.

---

## Phase Detection

Run each check. Record label as `ACTIVE` or `INACTIVE`.

```bash
ROOT=/Users/xfreddy2007/Documents/Self-projects/investment-helper

# Phase 1a — TS/Python package scaffolds exist (T-0101, T-0102)
test -f "$ROOT/apps/slack-bot/package.json" \
  && test -f "$ROOT/research/quant-python/pyproject.toml" \
  && echo "PHASE1_SCAFFOLD=ACTIVE" || echo "PHASE1_SCAFFOLD=INACTIVE"

# Phase 1b — Prisma schema exists (T-0103); gating DB-dependent tests
test -f "$ROOT/db/prisma/schema.prisma" \
  && echo "PHASE1_SCHEMA=ACTIVE" || echo "PHASE1_SCHEMA=INACTIVE"

# Phase 1 — combined: scaffold + schema (legacy alias; used by downstream checks)
test -f "$ROOT/apps/slack-bot/package.json" \
  && test -f "$ROOT/research/quant-python/pyproject.toml" \
  && test -f "$ROOT/db/prisma/schema.prisma" \
  && echo "PHASE1=ACTIVE" || echo "PHASE1=INACTIVE"

# Phase 2 — Fixture asset JSON files created (T-0201 to T-0204)
# Check for actual files, not just directories (dirs exist from T1.1.1 skeleton)
find "$ROOT/packages/fixtures/portfolios" -maxdepth 1 -name "*.json" 2>/dev/null | grep -q . \
  && find "$ROOT/packages/fixtures/prices" -maxdepth 1 -name "*.json" 2>/dev/null | grep -q . \
  && find "$ROOT/packages/fixtures/news" -maxdepth 1 -name "*.json" 2>/dev/null | grep -q . \
  && echo "PHASE2=ACTIVE" || echo "PHASE2=INACTIVE"

# Phase 3 — TypeScript app shell implemented (config + db + renderer + command router)
test -f "$ROOT/apps/slack-bot/src/config/index.ts" \
  && test -f "$ROOT/apps/slack-bot/src/db/prismaClient.ts" \
  && test -f "$ROOT/apps/slack-bot/src/renderers/dailyRecommendation.ts" \
  && echo "PHASE3=ACTIVE" || echo "PHASE3=INACTIVE"

# Phase 4 — Python quant core implemented
test -f "$ROOT/research/quant-python/src/investment_research/portfolio/allocation.py" \
  && test -f "$ROOT/research/quant-python/src/investment_research/jobs/generate_daily_recommendations.py" \
  && echo "PHASE4=ACTIVE" || echo "PHASE4=INACTIVE"

# Phase 5 — Source ingestion and wiki implemented
test -f "$ROOT/apps/slack-bot/src/orchestration/wikiWriter.ts" \
  && test -f "$ROOT/apps/slack-bot/src/orchestration/deduplication.ts" \
  && echo "PHASE5=ACTIVE" || echo "PHASE5=INACTIVE"

# Phase 6 — Trigger and recommendation integration implemented
test -f "$ROOT/apps/slack-bot/src/orchestration/triggerScoring.ts" \
  && test -f "$ROOT/apps/slack-bot/src/orchestration/alertBudget.ts" \
  && test -d "$ROOT/apps/slack-bot/tests/e2e" \
  && echo "PHASE6=ACTIVE" || echo "PHASE6=INACTIVE"

# Phase 7 — Slack MVP commands implemented
test -f "$ROOT/apps/slack-bot/src/slack/commands/status.ts" \
  && test -f "$ROOT/apps/slack-bot/src/slack/commands/feedback.ts" \
  && echo "PHASE7=ACTIVE" || echo "PHASE7=INACTIVE"

# Phase 9 — Provider adapters implemented
test -f "$ROOT/apps/slack-bot/src/providers/alphaVantage/index.ts" \
  && echo "PHASE9=ACTIVE" || echo "PHASE9=INACTIVE"

# Phase 10 — Evaluation and hardening implemented
test -f "$ROOT/research/quant-python/src/investment_research/jobs/evaluate_paper_recommendations.py" \
  && echo "PHASE10=ACTIVE" || echo "PHASE10=INACTIVE"
```

---

## Test Groups

### Group 0 — Infrastructure Health
**Phase**: always active
**Purpose**: Verify Docker, DB, migrations, and both test frameworks start cleanly.

#### T0.1 — PostgreSQL container is healthy
- Already verified in Infrastructure Setup S3. Record PASS if S3 passed.

#### T0.2 — Prisma schema validates
- **Phase**: PHASE1_SCHEMA
- Command: `npx prisma validate --schema /Users/xfreddy2007/Documents/Self-projects/investment-helper/db/prisma/schema.prisma`
- Verify: exit code 0
- Type: happy path

#### T0.3 — TypeScript test suite passes
- **Phase**: PHASE1_SCAFFOLD
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npm test 2>&1`
- Verify: exit code 0
- Type: happy path

#### T0.4 — Python test suite passes
- **Phase**: PHASE1_SCAFFOLD
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/research/quant-python && uv run pytest 2>&1`
- Verify: exit code 0
- Type: happy path

#### T0.5 — TypeScript build produces no type errors
- **Phase**: PHASE1_SCAFFOLD
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npm run typecheck 2>&1`
- Verify: exit code 0, no type errors
- Type: happy path

#### T0.6 — Python package installs without errors
- **Phase**: PHASE1_SCAFFOLD
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/research/quant-python && uv sync 2>&1`
- Verify: exit code 0
- Type: happy path

---

### Group 0A — Shared Schemas and Database Seed
**Phase**: PHASE1_SCHEMA
**Purpose**: Prisma migration applies cleanly, shared Zod schemas compile, and DB seed is idempotent.

#### T0A.1 — Prisma migration applies to clean local DB
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper && npx prisma migrate deploy --schema db/prisma/schema.prisma 2>&1`
- Verify: exit code 0, migration completes without errors
- Type: happy path

#### T0A.2 — Zod schemas import and compile without TypeScript errors
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx -e "import('./src/providers/fixtures/index.ts').then(() => { console.log('OK'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })" 2>&1`
- Verify: exit code 0, output contains `OK`
- Type: happy path

#### T0A.3 — DB seed inserts schema_versions row
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper && npx tsx db/seeds/seed.ts 2>&1`
- Verify: exit code 0, output confirms at least one `schema_versions` row inserted
- Type: happy path

#### T0A.4 — DB seed is idempotent on re-run
- Command: run seed script twice in sequence
- Verify: second run exits 0, no duplicate key errors, row count unchanged
- Type: edge case

#### T0A.5 — Missing DATABASE_URL produces a clear startup error (not a crash)
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && DATABASE_URL="" npx tsx src/config/index.ts 2>&1`
- Verify: exit code non-zero, output contains readable error about `DATABASE_URL`; no unhandled exception stack trace without context
- Type: error case

---

### Group 0B — TypeScript App Shell
**Phase**: Phase 3 (`PHASE3=ACTIVE`)
**Purpose**: Env validation, DB client, provider adapter, renderer, and command router are correct in isolation.

#### T0B.1 — Valid env passes Zod validation without error
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx -e "import('./src/config/index.ts').then(m => { console.log('VALID'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); })" 2>&1`
- Verify: exit code 0, output contains `VALID`
- Type: happy path

#### T0B.2 — Missing SLACK_BOT_TOKEN throws Zod validation error with field name
- Command: same as T0B.1 but with `SLACK_BOT_TOKEN=""` prefix
- Verify: exit code non-zero, output contains `SLACK_BOT_TOKEN` in error message
- Type: error case

#### T0B.3 — Prisma client wrapper connects to local DB and reads schema_versions
- Command: integration test in `apps/slack-bot/tests/integration/db/prismaClient.test.ts`
- Verify: exit code 0, query returns at least 1 row from `schema_versions`
- **Depends on**: T0A.3 (seed has run)
- Type: happy path

#### T0B.4 — Fixture provider adapter contract test passes
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx tests/integration/providers/fixtureAdapter.test.ts 2>&1`
- Verify: exit code 0, normalized source records have required fields (`symbol`, `source`, `timestamp`)
- Type: happy path

#### T0B.5 — Slack daily recommendation renderer includes Traditional Chinese section headings
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx tests/unit/renderers/dailyRecommendation.snapshot.test.ts 2>&1`
- Verify: exit code 0, output contains `今日觀察`, `可考慮調整`, `不建議動作`
- Type: happy path

#### T0B.6 — Slack renderer includes paper-only disclaimer
- Command: same snapshot test
- Verify: output contains text indicating no broker order will be placed
- Type: happy path (negative assertion)

#### T0B.7 — Unknown Slack subcommand returns usage help without error stack
- Command: integration test for command router with unknown input
- Verify: response text contains usage hint, no unhandled exception output
- Type: error case

---

### Group 1 — Fixture Assets via Loader
**Phase**: Phase 3 (`PHASE3=ACTIVE`)
**Purpose**: Fixture files load correctly via the TypeScript fixture loader module (`src/providers/fixtures/index.ts`, implemented in T-0303).
**Note**: Fixture file content validation (Zod schemas) is covered by `tests/fixtures/fixtures.test.ts` (PHASE2, unit tests). This group tests the loader interface.

#### T1.1 — Taiwan ETF portfolio fixture loads
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx -e "import('./src/providers/fixtures/index.ts').then(m => m.loadPortfolioFixture('tw-etf')).then(p => { console.log(JSON.stringify(p)); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })" 2>&1`
- Verify: exit code 0, output contains `"market":"TW"` and `"asset_type":"ETF"`
- Type: happy path

#### T1.2 — US ETF portfolio fixture loads
- Command: same pattern with `'us-etf'`
- Verify: exit code 0, output contains `"market":"US"` and `"asset_type":"ETF"`
- Type: happy path

#### T1.3 — Mixed portfolio fixture loads
- Command: same pattern with `'mixed'`
- Verify: exit code 0, output contains both `"market":"TW"` and `"market":"US"`
- Type: happy path

#### T1.4 — Price snapshot fixtures load with required fields
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx -e "import('./src/providers/fixtures/index.ts').then(m => m.loadAllPriceSnapshots()).then(p => { console.log(JSON.stringify(p)); process.exit(0); }).catch(e => { process.exit(1); })" 2>&1`
- Verify: exit code 0, output contains `VOO`, `0050.TW`, `2330.TW`, and each record has `symbol`, `price`, `currency`, `timestamp`
- Type: happy path

#### T1.5 — News fixtures load with required fields
- Command: same pattern for all news fixtures
- Verify: exit code 0, each record has `title`, `url`, `market`, `published_at`, `content`
- Type: happy path

#### T1.6 — Malformed fixture returns validation error without crashing
- Command: create a temp malformed JSON fixture file, then attempt to load it
- Verify: exit code non-zero or output contains validation error message; process does not throw uncaught exception
- Type: error case

---

### Group 2 — Portfolio Models and Allocation
**Phase**: Phase 4
**Purpose**: Allocation calculation is correct for all portfolio types.
**Depends on**: Group 1 (fixtures loaded)

#### T2.0 — Python Pydantic settings loads valid config without error
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/research/quant-python && uv run pytest tests/config/test_settings.py -v 2>&1`
- Verify: exit code 0, output contains `PASSED`
- Type: happy path

#### T2.0b — Python settings raises ValidationError when DATABASE_URL missing
- Command: `uv run pytest tests/config/test_settings.py::test_missing_database_url -v 2>&1`
- Verify: exit code 0, `PASSED` (test expects ValidationError)
- Type: error case

#### T2.1 — Taiwan ETF allocation percentages sum to 100
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/research/quant-python && uv run pytest tests/portfolio/test_allocation.py::test_tw_etf_allocation_sums_to_100 -v 2>&1`
- Verify: exit code 0, output contains `PASSED`
- Type: happy path

#### T2.2 — US ETF allocation percentages sum to 100
- Command: `uv run pytest tests/portfolio/test_allocation.py::test_us_etf_allocation_sums_to_100 -v 2>&1`
- Verify: exit code 0, output contains `PASSED`
- Type: happy path

#### T2.3 — Mixed portfolio buckets match target allocation config
- Command: `uv run pytest tests/portfolio/test_allocation.py::test_mixed_portfolio_bucket_allocation -v 2>&1`
- Verify: exit code 0, output contains `PASSED`
- Type: happy path

#### T2.4 — cost_basis null activates pure drift mode
- Command: `uv run pytest tests/portfolio/test_allocation.py::test_null_cost_basis_pure_drift_mode -v 2>&1`
- Verify: exit code 0, tax_sensitive flag is False in output
- Type: edge case

#### T2.5 — cost_basis provided activates tax-sensitive mode
- Command: `uv run pytest tests/portfolio/test_allocation.py::test_cost_basis_tax_sensitive_mode -v 2>&1`
- Verify: exit code 0, tax_sensitive flag is True and lot_method is set
- Type: edge case

#### T2.6 — Missing price for held symbol degrades gracefully
- Command: `uv run pytest tests/portfolio/test_allocation.py::test_missing_price_graceful_degradation -v 2>&1`
- Verify: exit code 0 (handled), output does not contain `KeyError` or unhandled traceback
- Type: error case

---

### Group 3 — Drift Detection and Rebalancing
**Phase**: Phase 4
**Purpose**: Drift thresholds and rebalancing rules fire correctly.

#### T3.1 — Allocation within threshold produces no-action
- Command: `uv run pytest tests/recommendation/test_drift.py::test_within_threshold_no_action -v 2>&1`
- Verify: exit code 0, recommended_action is `do_not_act` or `hold`
- Type: happy path

#### T3.2 — Allocation exceeds threshold produces rebalance recommendation
- Command: `uv run pytest tests/recommendation/test_drift.py::test_exceeds_threshold_rebalance -v 2>&1`
- Verify: exit code 0, recommended_action is `rebalance`, suggested_size_min and suggested_size_max are non-null
- Type: happy path

#### T3.3 — Rebalance recommendation includes rationale and confidence
- Command: `uv run pytest tests/recommendation/test_drift.py::test_rebalance_includes_rationale -v 2>&1`
- Verify: exit code 0, output contains rationale string and confidence value 1-5
- Type: happy path

#### T3.4 — Cash below minimum floor suppresses add_position
- Command: `uv run pytest tests/recommendation/test_drift.py::test_low_cash_suppresses_add_position -v 2>&1`
- Verify: exit code 0, recommended_action is NOT `add_position`
- Type: edge case

#### T3.5 — Routine drift and event risk both present produces two separate sections
- Command: `uv run pytest tests/recommendation/test_drift.py::test_dual_signal_separate_sections -v 2>&1`
- Verify: exit code 0, output distinguishes routine_rebalance from event_adjustment
- Type: edge case

---

### Group 4 — Event-Aware Risk Adjustment
**Phase**: Phase 4
**Purpose**: Event severity, relevance, and confidence drive the right advisory action.

#### T4.1 — severity 4 + relevance 3 + confidence 3 produces reduce_position or hedge
- Command: `uv run pytest tests/recommendation/test_event_adjustment.py::test_sev4_rel3_conf3_produces_action -v 2>&1`
- Verify: exit code 0, recommended_action in [`reduce_position`, `hedge`]
- Type: happy path

#### T4.2 — severity 5 + relevance 4 + low confidence still produces alert with uncertainty note
- Command: `uv run pytest tests/recommendation/test_event_adjustment.py::test_sev5_low_conf_uncertainty_note -v 2>&1`
- Verify: exit code 0, recommended_action set, rationale contains uncertainty language
- Type: edge case

#### T4.3 — severity 4 + confidence 1 produces monitor or research_required (not reduce)
- Command: `uv run pytest tests/recommendation/test_event_adjustment.py::test_sev4_low_conf_monitor_only -v 2>&1`
- Verify: exit code 0, recommended_action in [`monitor`, `research_required`]
- Type: edge case

#### T4.4 — Event irrelevant to holdings produces do_not_act
- Command: `uv run pytest tests/recommendation/test_event_adjustment.py::test_irrelevant_event_no_action -v 2>&1`
- Verify: exit code 0, recommended_action is `do_not_act`
- Type: edge case

#### T4.5 — severity 5 + portfolio_relevance < 4 falls back to normal threshold
- Command: `uv run pytest tests/recommendation/test_event_adjustment.py::test_sev5_low_relevance_normal_threshold -v 2>&1`
- Verify: exit code 0, alert_should_post reflects normal threshold rule
- Type: edge case

#### T4.6 — Event with null affected tickers produces no portfolio impact
- Command: `uv run pytest tests/recommendation/test_event_adjustment.py::test_null_tickers_no_impact -v 2>&1`
- Verify: exit code 0, affected_holdings is empty, recommended_action is `do_not_act`
- Type: error case

---

### Group 5 — Paper Recommendation Writer
**Phase**: Phase 4
**Purpose**: Paper recommendations are persisted correctly and retrievable.

#### T5.1 — Rebalancing recommendation writes full paper_recommendation row
- Command: `uv run pytest tests/db/test_paper_recommendation.py::test_rebalance_writes_full_row -v 2>&1`
- Verify: exit code 0, row contains symbol, market, action, suggested_size_min, suggested_size_max, rationale, confidence, portfolio_snapshot_id, created_at
- Type: happy path

#### T5.2 — Written paper recommendation is readable by ID
- Command: `uv run pytest tests/db/test_paper_recommendation.py::test_paper_recommendation_readable_by_id -v 2>&1`
- Verify: exit code 0, retrieved row matches written row by id
- Type: happy path

#### T5.3 — Paper recommendation never sends broker order
- Command: `uv run pytest tests/db/test_paper_recommendation.py::test_no_broker_order_sent -v 2>&1`
- Verify: exit code 0, no `execution` or `broker_order` records created
- Type: happy path (negative assertion)

---

### Group 6 — Source Ingestion and Wiki
**Phase**: Phase 5
**Purpose**: Fixture news creates correct raw files, DB records, and wiki pages.

#### T6.1 — Taiwan news fixture creates raw source file and DB row
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx src/orchestration/ingestFixtureSources.ts --fixture packages/fixtures/news/tw-market-news.json 2>&1`
- Verify: exit code 0, a file exists under `knowledge/raw/news/`, DB `sources` table has a row with matching hash
- Type: happy path

#### T6.2 — US news fixture creates raw source file and DB row
- Command: same with US news fixture
- Verify: exit code 0, file exists, DB row exists with `market=US`
- Type: happy path

#### T6.3 — Geopolitical shock fixture tagged with correct risk_tags
- Command: ingest geopolitical shock fixture
- Verify: exit code 0, `news_analyses` DB row has `risk_tags` containing `geopolitical`
- Type: happy path

#### T6.4 — log.md appended after each ingest
- Command: check line count of `knowledge/wiki/log.md` before and after ingest
- Verify: line count increased after ingest; new entry contains ISO date and source id
- Type: happy path

#### T6.5 — Duplicate fixture: same title + URL produces one source, one suppression record
- Command: ingest duplicate-news fixture twice
- Verify: `sources` table has 1 row (not 2); suppression is logged in output or DB
- Type: edge case

#### T6.6 — Cross-market story classified as GLOBAL
- Command: ingest a news fixture with spillover between TW and US markets
- Verify: `news_analyses` row has `market=GLOBAL` or both TW and US in `markets` field
- Type: edge case

#### T6.7 — Malformed news fixture logs error without crashing ingestion of remaining fixtures
- Command: ingest a batch containing one malformed item and one valid item
- Verify: exit code 0 (batch continues), error logged for malformed item, valid item persisted
- Type: error case

---

### Group 7 — Trigger Scoring and Alert Budget
**Phase**: Phase 6
**Purpose**: Severity, relevance, budget caps, and duplicate suppression all fire correctly.

#### T7.1 — Geopolitical shock produces trigger_evaluation with severity >= 4
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx -e "import('./src/orchestration/triggerScoring.ts')..." 2>&1` (or vitest integration test)
- Verify: DB `trigger_evaluations` row has severity >= 4 and relevance >= 3
- Type: happy path

#### T7.2 — Low-confidence fixture produces monitor or research_required action
- Command: score low-confidence noisy news fixture
- Verify: `trigger_evaluations.suggested_action` in [`monitor`, `research_required`]
- Type: edge case

#### T7.3 — 3rd Taiwan event-driven alert of day is posted
- Command: `cd apps/slack-bot && npx tsx src/orchestration/alertBudget.ts --simulate tw 3 2>&1`
- Verify: output indicates alert 3 is ALLOWED
- Type: happy path

#### T7.4 — 4th Taiwan event-driven alert of day is suppressed
- Command: simulate 4 Taiwan alerts on same date
- Verify: 4th alert is SUPPRESSED in output or DB `suppressed_alerts` log
- Type: happy path (budget enforcement)

#### T7.5 — 4th US event-driven alert of day is suppressed
- Command: simulate 4 US alerts on same date
- Verify: 4th alert SUPPRESSED
- Type: happy path (budget enforcement)

#### T7.6 — Severity-5 override: 5th Taiwan alert allowed (up to cap of 5)
- Command: simulate 5 severity-5 Taiwan alerts on same date
- Verify: alerts 4 and 5 are ALLOWED under override cap
- Type: edge case

#### T7.7 — Severity-5 override: 6th Taiwan alert suppressed (cap of 5 holds)
- Command: simulate 6 severity-5 Taiwan alerts on same date
- Verify: 6th alert is SUPPRESSED — cap of 5 is absolute, no unlimited override
- Type: edge case

#### T7.8 — Duplicate trigger suppressed when no new facts
- Command: score the same event twice with identical facts
- Verify: second evaluation is SUPPRESSED, DB shows only one active trigger for that event
- Type: edge case

#### T7.9 — Severity increase on same event creates new trigger (not suppressed)
- Command: score same event twice; second time with severity increased by 1
- Verify: second evaluation NOT suppressed, new trigger row created with higher severity
- Type: edge case

---

### Group 8 — Full E2E Fixture Pipeline
**Phase**: Phase 6
**Purpose**: Complete fixture-to-Slack-render pipeline runs end-to-end with correct output.
**Depends on**: Groups 1-7 pass

#### T8.1 — E2E pipeline exits zero and prints recommendation + paper IDs
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper && npm run e2e:fixture 2>&1`
- Verify: exit code 0, output contains `daily_recommendation_id:` and `paper_recommendation_id:` with non-null values
- Type: happy path

#### T8.2 — Slack daily recommendation render contains all three sections
- Command: run the TypeScript renderer against the seeded recommendation
- Verify: output contains `今日觀察`, `可考慮調整`, `不建議動作`
- Type: happy path

#### T8.3 — Slack render contains paper-only disclaimer
- Verify: output contains `Paper Recommendation` and text indicating no broker order
- Type: happy path

#### T8.4 — Taiwan brief labeled with TW market and correct schedule marker
- Command: render Taiwan pre-market brief from fixture
- Verify: output contains `台股` or `TW` and `08:30` or `08:30 Taipei`
- Type: happy path

#### T8.5 — US brief labeled with US market
- Command: render US pre-market brief from fixture
- Verify: output contains `US` or `美股` and either `21:00` or `22:00` Taipei time reference
- Type: happy path

#### T8.6 — No-material-alerts state populates 不建議動作 section
- Command: run pipeline with low-severity fixture (no alerts should fire)
- Verify: output contains `不建議動作` with a non-empty rationale, `可考慮調整` may be empty or absent
- Type: edge case

---

### Group 9 — Slack Commands (Mock Client)
**Phase**: Phase 7
**Purpose**: All slash command handlers produce correct output with real DB and mock Bolt context.
**Depends on**: Group 8 pipeline has run (recommendations exist in DB)

#### T9.1 — /investment status returns connectivity and last recommendation timestamp
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx tests/integration/commands/status.test.ts 2>&1`
- Verify: exit code 0, output contains DB status OK and ISO timestamp of last recommendation
- Type: happy path

#### T9.2 — /investment portfolio shows TW and US allocation buckets
- Command: integration test for portfolio command
- Verify: output contains bucket names and allocation percentages for both TW and US
- Type: happy path

#### T9.3 — /investment recommendation today renders 3-part structure
- Command: integration test for recommendation today command
- Verify: output contains `今日觀察`, `可考慮調整`, `不建議動作`, and paper-only disclaimer
- Type: happy path

#### T9.4 — /investment brief today renders combined brief or friendly no-brief state
- Command: integration test for brief today command
- Verify: output contains brief content OR friendly message (not an error stack)
- Type: happy path + edge case (no brief available)

#### T9.5 — /investment brief tw renders Taiwan pre-market brief
- Verify: output contains TW-specific content
- Type: happy path

#### T9.6 — /investment brief us renders US pre-market brief
- Verify: output contains US-specific content
- Type: happy path

#### T9.7 — /investment paper-log lists recent paper recommendations with IDs
- Verify: output contains at least one row with id, action, symbol, status
- Type: happy path

#### T9.8 — /investment explain <valid-id> returns rationale and citations
- Command: use a seeded paper recommendation ID
- Verify: output contains rationale text and at least one source citation
- Type: happy path

#### T9.9 — /investment explain <invalid-id> returns friendly not-found
- Command: use a non-existent ID
- Verify: output contains not-found message, no error stack
- Type: error case

#### T9.10 — /investment mute VOO records preference; VOO alerts suppressed
- Command: run mute command, then generate a VOO alert
- Verify: mute preference written to DB, subsequent VOO alert filtered from output
- Type: happy path + integration

#### T9.11 — /investment feedback <id> useful writes feedback_event row
- Verify: DB `feedback_events` has row with alert_id and feedback=`useful`
- Type: happy path

#### T9.12 — /investment feedback <id> with all feedback types writes correct rows
- Command: test `not_useful`, `too_noisy`, `too_late` in sequence
- Verify: 3 feedback_event rows with correct feedback values
- Type: happy path

#### T9.13 — Unknown subcommand /investment foo returns friendly error
- Command: integration test with unknown subcommand
- Verify: output contains usage help or friendly error, no error stack
- Type: error case

---

### Group 10 — Slack Signature Validation
**Phase**: Phase 7
**Purpose**: Inbound Slack event signatures are validated correctly.

#### T10.1 — Valid signing secret allows request to proceed
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx tests/integration/slack/signatureValidation.test.ts --case valid 2>&1`
- Verify: exit code 0, request is accepted (HTTP 200 or handler called)
- Type: happy path

#### T10.2 — Invalid signing secret rejects request
- Command: same test with tampered signature
- Verify: request is rejected (HTTP 403 or handler NOT called)
- Type: error case

#### T10.3 — Replayed request (timestamp > 5 minutes old) is rejected
- Command: same test with old timestamp
- Verify: request rejected
- Type: edge case

---

### Group 11 — Provider Failure Isolation
**Phase**: Phase 9
**Purpose**: Provider failures are logged and isolated; Slack commands continue working.

#### T11.1 — Alpha Vantage adapter parses mock payload into normalized records
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/apps/slack-bot && npx tsx tests/integration/providers/alphaVantage.test.ts 2>&1`
- Verify: exit code 0, normalized records have required fields (symbol, price, timestamp, source)
- Type: happy path

#### T11.2 — Alpha Vantage rate limit reached logs rate_limit in provider_runs
- Command: simulate rate limit response (429 or quota exceeded message)
- Verify: `provider_runs` DB row has status=`rate_limit` or `quota_exceeded`; no uncaught exception
- Type: edge case

#### T11.3 — Alpha Vantage 500 error logs failure without breaking Slack commands
- Command: simulate provider 500 response, then call `/investment status`
- Verify: provider_runs has status=`failed`; status command still responds successfully
- Type: error case

#### T11.4 — Network timeout logs timeout without breaking Slack commands
- Command: simulate network timeout (zero-byte response after delay)
- Verify: provider_runs has status=`timeout`; Slack command still responds
- Type: error case

---

### Group 12 — Paper Recommendation Evaluation
**Phase**: Phase 10
**Purpose**: Evaluations compute correctly and update paper recommendations.

#### T12.1 — 5-day return calculated correctly from fixture price path
- Command: `cd /Users/xfreddy2007/Documents/Self-projects/investment-helper/research/quant-python && uv run pytest tests/evaluation/test_returns.py::test_5day_return_from_fixture -v 2>&1`
- Verify: exit code 0, return value matches expected from fixture price delta
- Type: happy path

#### T12.2 — Allocation discipline: improved score when recommendation moved toward target
- Command: `uv run pytest tests/evaluation/test_allocation_discipline.py::test_improved_score -v 2>&1`
- Verify: exit code 0, discipline_score > 0 or classification is `improved`
- Type: happy path

#### T12.3 — Allocation discipline: unchanged score when recommendation made no change
- Verify: discipline_score = 0 or classification is `unchanged`
- Type: edge case

#### T12.4 — Allocation discipline: worsened score when recommendation moved away from target
- Verify: discipline_score < 0 or classification is `worsened`
- Type: edge case

#### T12.5 — Evaluation row links back to original paper_recommendation ID
- Command: `uv run pytest tests/evaluation/test_persistence.py::test_evaluation_links_to_recommendation -v 2>&1`
- Verify: exit code 0, `paper_evaluations.paper_recommendation_id` matches the original
- Type: happy path

#### T12.6 — /investment paper-log shows evaluation status for evaluated recommendations
- Command: integration test for paper-log command after evaluation job runs
- Verify: output includes evaluation status (`evaluated`, `pending`, or `improved/unchanged/worsened`)
- Type: happy path

#### T12.7 — Evaluation pending when horizon not yet reached
- Command: create paper recommendation dated today, run evaluation job
- Verify: evaluation_status is `pending` (20/60/120-day horizon not elapsed)
- Type: edge case

#### T12.8 — Missing price fixture for evaluation period defers evaluation
- Command: run evaluation job with no price data after recommendation date
- Verify: evaluation not written, job exits cleanly, logs `deferred - no price data`
- Type: error case

---

## Adding New Test Cases

When a new feature, milestone task, or Slack command is implemented, add test cases here.

### Where to add

- Find the matching group (by phase and domain), or create a new Group N.
- If creating a new group: add a phase detection check in the **Phase Detection** section.
- Groups between 0 and 1 use alpha suffixes (0A, 0B, 0C…) so Group 1-12 numbers stay stable.
- PHASE1_SCAFFOLD: tests that only need package.json / pyproject.toml.
- PHASE1_SCHEMA: tests that need db/prisma/schema.prisma to exist.

### Case format

```markdown
#### T[Group].[N] — Short description
- **Phase**: Phase N (or "always active")
- Command: `exact shell command or test file path`
- Verify: specific condition (exit code, output substring, DB field, file path)
- Type: happy path | edge case | error case | negative assertion
- **Depends on**: [prior test ID] (if applicable)
```

### Coverage checklist for each new feature

- [ ] Happy path: typical input produces expected output
- [ ] Edge case: boundary value, optional field absent, empty state
- [ ] Error case: invalid input, missing dependency, provider failure
- [ ] Negative assertion: action that must NOT happen (e.g., no broker order, no duplicate alert)
- [ ] Multi-step flow: if feature spans multiple jobs or commands, test the sequence
- [ ] Budget/threshold enforcement: if feature has limits, test at limit and over limit

### Phase gate rule

A group's phase gate should be the last task in that milestone that the group's tests depend on.
Use file existence checks (`test -f path`) as phase proxies — they are fast and reliable.
