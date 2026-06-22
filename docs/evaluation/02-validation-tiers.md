# §02 — Validation Tiers (Fast / Full / Deep)

> **Decided spec** (was a discussion stub). Defines the three execution lanes and the single orchestrator
> command — `scripts/validate.ts`, run via `npm run validate:fast|full|deep`. Parent: [README](./README.md).

## The three lanes

| Tier | Budget | Trigger | Contents | Needs Postgres? |
|------|--------|---------|----------|-----------------|
| **Fast** | seconds (~10s) | every change / pre-commit | typecheck + vitest + pytest | No — DB tests self-skip |
| **Full** | minutes — the canonical "complete validation" | pre-merge | Fast (DB live) + e2e subset + quality-gate + backtest gate + backtest report | Yes — auto-brought-up |
| **Deep** | minutes+ | pre-release / nightly | Full + 30-day smoke + robustness sweeps | Yes |

**Fast is DB-free by design.** The `apps/slack-bot` DB-integration vitest tests catch an unreachable Postgres
(`ECONNREFUSED`/`P1001`/`P1013`) and self-skip with a `console.warn` — see
`tests/integration/db/prismaClient.test.ts` and `tests/config/db.test.ts`. So `vitest run` stays green DB-down
(DB assertions skip). Under **Full**, Postgres is up first, so those same tests actually assert.

## The orchestrator — `scripts/validate.ts`

One entrypoint, three named scripts. Runs the tier's steps **in order**, **stops at the first hard failure**
(`gate`/`infra`), prints a per-step pass/fail table, and writes a machine-readable report.

```bash
npm run validate:fast   # typecheck + vitest + pytest                (DB-free, ~10s)
npm run validate:full   # the complete pre-merge validation           (brings up Postgres)
npm run validate:deep   # full + 30-day smoke + robustness (TODO §06) (periodic)
```

**Step kinds** — every step is one of:

- `gate` — non-zero exit **fails the run** and stops it.
- `infra` — a prerequisite (Postgres bring-up); non-zero **aborts** Full/Deep.
- `report` — runs for its artifact/signal but **never fails the run** (non-zero → `⚠️ warn`, recorded only).

**Step inventory** (all wire *existing* commands — no new test logic):

| Step id | Command | Tier(s) | kind |
|---------|---------|---------|------|
| `typecheck` | `npm --prefix apps/slack-bot run typecheck` | fast/full/deep | gate |
| `ts-unit` | `npm --prefix apps/slack-bot test` (vitest) | fast/full/deep | gate |
| `py-unit` | `uv run pytest` (in `research/quant-python`) | fast/full/deep | gate |
| `db-up` | `docker compose up -d postgres` → wait healthy (60s) → `prisma migrate deploy` | full/deep | infra |
| `e2e-prisma-validate` | `npx prisma validate` (e2e T0.2) | full/deep | gate |
| `quality-gate` | `npm run quality-gate` | full/deep | gate |
| `backtest-gate` | `npm run backtest:fixtures` (FP-rate gate) | full/deep | gate |
| `backtest-report` | `npx tsx scripts/backtest-2025/run.ts` | full/deep | **report** |
| `backtest-30d` | `BT_DATA_DIR=scripts/backtest-30d npx tsx scripts/backtest-2025/run.ts` | deep | **report** |
| `robustness` | walk-forward / PBO / deflated Sharpe | deep | report — **TODO → [§06](./06-robustness-and-overfitting.md)** |

**Output contract.** Console table + `scripts/out/validate-report.json`:

```json
{ "tier": "full", "startedAt": "…", "durationMs": 10800, "status": "pass",
  "firstFailure": null,
  "steps": [ { "id": "typecheck", "kind": "gate", "status": "pass", "exitCode": 0, "durationMs": 1494 }, … ] }
```

Process **exit code** = the first failing step's exit code (0 when all pass) — so an agent or pre-commit hook can
branch on it directly. On failure the orchestrator prints the failing step's output tail for fast diagnosis.

## e2e handling — curated CLI subset, skill stays authoritative

The `/e2e-test` skill (an LLM-driven runbook over `.claude/e2e-tests.md`) remains the **authoritative** full
functional suite. `validate.ts` shells only a small subset: the e2e checks that are pure-CLI, exit-code
verifiable, **and not already covered by the Fast lane**.

In practice that subset is tiny on purpose — most e2e cases reduce to `vitest`/`pytest`/`typecheck` the Fast lane
already runs (e2e T0.3/T0.4/T0.5 = `npm test` / `uv run pytest` / `npm run typecheck`; Group 12 = pytest
selectors already in `py-unit`). The one genuinely **additive** CLI check is **T0.2 `prisma validate`** (schema
integrity, run nowhere else) → `e2e-prisma-validate`.

**Drift risk (accepted):** the subset is hand-maintained in `validate.ts`, separate from `.claude/e2e-tests.md`.
Keep it minimal; for full coverage run `/e2e-test`. Run Full's automatable lanes via `npm run validate:full`,
then `/e2e-test` for the agent-driven remainder — together they are the complete Full tier.

## DB bring-up (Full/Deep)

`db-up` mirrors e2e setup **S2–S4** against `docker-compose.yml` (Postgres only, port 5433, `pg_isready`
healthcheck): `docker compose up -d postgres` → poll `docker compose ps` for `healthy` (≤60s) →
`npx prisma migrate deploy --schema db/prisma/schema.prisma`. The destructive `down -v` (e2e S1) is **not**
run — Full validates against the current schema, it does not wipe data. (A `--clean` opt-in can be added later
if a from-scratch DB is needed.)

`.env` is loaded by `validate.ts` with the same minimal parser as `qualityGate.ts` (never
`export $(grep .env | xargs)` — that leaks the whole env). `DATABASE_URL` defaults to the compose DSN.

## Resolved design decisions

- **New `scripts/validate.ts`**, not an extension of `qualityGate.ts` — the gate becomes one *step* of Full.
- **Named scripts** (`validate:fast|full|deep`), not a bare `--tier` flag — discoverable in `package.json`.
- **Fast = static (typecheck) + unit only.** No lint step exists (no ruff/eslint wired); add later if introduced.
- **`backtest-2025/run.ts` stays report-only** here (always exits 0). Its regression *gate* is §04/§08 work.
- **Deep scheduling** stays manual / `/loop` for now — no CI (per [README §1](./README.md)).

## Links

- `scripts/validate.ts` · root `package.json` (`validate:*`) · `docker-compose.yml`
- `apps/slack-bot/src/orchestration/qualityGate.ts` · `scripts/backtest-2025/run.ts`
- `.claude/e2e-tests.md` (authoritative e2e) · [§08](./08-quality-gates-and-baselines.md) (gates) ·
  [§06](./06-robustness-and-overfitting.md) (robustness)
