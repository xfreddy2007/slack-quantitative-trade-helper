# §02 — Validation Tiers (Fast / Full / Deep)

> **Stub for discussion.** Defines the three execution lanes, their budgets, triggers, and the single
> orchestrator command that drives them. Parent: [README](./README.md).

## The lanes

| Tier | Budget | Trigger | Contents |
|------|--------|---------|----------|
| **Fast** | seconds | every change / pre-commit | `tsc --noEmit`, ruff, Vitest, pytest |
| **Full** | minutes | pre-merge — the canonical "complete validation" | Fast + functional e2e + pipeline/render gate + backtest regression + paper-eval + provider checks |
| **Deep** | minutes–longer | pre-release / nightly | Full + robustness sweeps (walk-forward, PBO, deflated Sharpe, threshold-sensitivity) |

## Mapping to existing assets

| Step | Command (today) | Tier |
|------|-----------------|------|
| TS typecheck | `npm --prefix apps/slack-bot run typecheck` | Fast |
| TS unit | `npm --prefix apps/slack-bot test` | Fast |
| Python unit | `uv run pytest` (in `research/quant-python`) | Fast |
| Functional e2e | `/e2e` skill → `.claude/e2e-tests.md` | Full |
| Pipeline/render gate | `npm run quality-gate` | Full |
| Backtest | `npx tsx scripts/backtest-2025/run.ts` (+ threshold check, new) | Full |
| Backtest (short) | `scripts/backtest-30d/` | Full / smoke |
| Robustness | new harness | Deep |

## The orchestrator command (to design)

A single entrypoint — e.g. `npm run validate -- --tier=full` — that runs the lane's steps in order,
**stops at the first hard failure**, and prints a pass/fail table per layer. Open design points:

- New script vs extend `qualityGate.ts`? (lean: new `validate.ts` orchestrator; gate becomes one step)
- How does it invoke the `/e2e` flow non-interactively (Docker + Postgres needed)?
- Tier selection via flag vs three named scripts (`validate:fast|full|deep`)?
- Exit-code contract + machine-readable summary (JSON) for agent consumption.

## Open questions for discussion

- Is Docker/Postgres assumed present for **Full**, or does the orchestrator bring it up (e2e S1–S4)?
- Should **Fast** include lint, or typecheck-only to stay sub-10s?
- Nightly **Deep** — scheduled how, given no CI? (manual / local cron / `/loop`)

## Links

- `package.json` (root scripts) · `apps/slack-bot/package.json` · `.claude/e2e-tests.md`
