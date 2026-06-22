# Evaluation & Validation Suite — Overview

> **Status:** planning skeleton. This directory defines the *canonical* validation suite for
> `investment-helper`. The overview below is complete; sections `01`–`09` are stubs that each seed a
> focused follow-up discussion before their implementation lands.

## 1. Purpose & when to run

This suite is the **single, repeatable validation we run after every bug-fix and every new feature** —
the thing that answers "did this change break correctness, signal quality, or robustness?" before it ships.

Today the pieces exist but are scattered: a functional e2e doc, a signal-quality backtest, two unit suites,
and a thin pipeline gate. None of them block on *quality regression*, and there is no overfitting/robustness
discipline. This directory unifies them into one tiered, threshold-gated, agent-invokable flow.

Trigger model: **local + agent-invoked** (a documented orchestrator command + the existing `/e2e` skill).
No CI gate yet — that's a deliberate later step (see §08).

## 2. Validation philosophy & threat model (full in [§01](./01-philosophy-and-threat-model.md))

We defend against **five regression classes**:

| # | Class | "Broke" looks like | Caught by |
|---|-------|--------------------|-----------|
| 1 | Functional | command crashes, wrong render, DB write missing | unit + functional e2e |
| 2 | Signal-quality | precision/recall/calibration degrade vs baseline | backtest regression gate |
| 3 | Overfitting | great on fixtures, fails out-of-sample | walk-forward / PBO / deflated Sharpe |
| 4 | Data / provider | adapter contract drift, silent provider failure | contract tests + failure isolation |
| 5 | Render / UX | missing TC sections, dropped paper-only disclaimer | render assertions |

Principles: **determinism** (golden baselines, fixed seeds), **out-of-sample discipline** (never tune on the
holdout), **buy/sell asymmetry** (precision-favored for "act", recall-favored for protective "reduce").

## 3. Layered validation stack

| Layer | Tool | Tier | Existing asset |
|-------|------|------|----------------|
| Static | `tsc --noEmit` + ruff | Fast | `apps/slack-bot`, `research/quant-python` |
| Unit | Vitest + pytest | Fast | 304 TS tests / 74 Py tests |
| Functional / e2e | `.claude/e2e-tests.md` via `/e2e` | Full | Groups 0–12 (~103 cases) |
| Pipeline / render gate | `qualityGate.ts` (to expand) | Full | `apps/slack-bot/src/orchestration/qualityGate.ts` |
| Signal-quality backtest | `scripts/backtest-2025/run.ts` | Full | + regression thresholds (new) |
| Paper-rec outcome eval | Python `evaluation/` + Group 12 | Full | `research/quant-python/.../evaluation/` |
| Robustness / overfitting | new harness (walk-forward, PBO, IC) | Deep | — (Phase 2) |
| Provider / data | Group 11 + contract tests | Full | `runIsolated`, provider adapters |

## 4. Three tiers

| Tier | Runtime | Runs when | Contents |
|------|---------|-----------|----------|
| **Fast** | seconds | every change / pre-commit | static + unit |
| **Full** | minutes | pre-merge — **the "complete" validation** | Fast + functional e2e + pipeline/render gate + backtest regression + paper-eval + provider |
| **Deep** | minutes–longer | pre-release / nightly | Full + robustness sweeps (walk-forward, PBO, deflated Sharpe, threshold-sensitivity) |

"Run the complete validation after every change" = the **Full** tier. **Deep** is the periodic overfitting audit.

## 5. Section index

| § | Doc | Scope |
|---|-----|-------|
| 01 | [Philosophy & threat model](./01-philosophy-and-threat-model.md) | why we validate; 5 regression classes; principles |
| 02 | [Validation tiers](./02-validation-tiers.md) | Fast/Full/Deep contents, budgets, the orchestrator command |
| 03 | [Functional e2e](./03-functional-e2e.md) | wraps `.claude/e2e-tests.md`; FR1–FR10 coverage map; gaps |
| 04 | [Signal-quality evaluation](./04-signal-quality-evaluation.md) | backtest metrics + IC; regression thresholds; golden baseline |
| 05 | [Recommendation / paper eval](./05-recommendation-paper-eval.md) | outcome eval, allocation discipline, horizons |
| 06 | [Robustness & overfitting](./06-robustness-and-overfitting.md) | walk-forward, PBO, deflated Sharpe, sensitivity sweeps |
| 07 | [Data & provider validation](./07-data-and-provider-validation.md) | contract tests, failure isolation, live out-of-sample track |
| 08 | [Quality gates & baselines](./08-quality-gates-and-baselines.md) | pass/fail criteria, baseline registry, run procedure |
| 09 | [Metrics glossary](./09-metrics-glossary.md) | every metric: definition, formula, current value |

## 6. Current baseline snapshot

Captured from `scripts/backtest-2025/out/report.json` (label *2025 full-year*, period 2025-01-27 .. 2025-12-22)
and `docs/features/feature-trigger-quality-fixes/tasks.md`. These become the regression baselines in §08.

| Metric | Baseline | Source |
|--------|----------|--------|
| TS unit line coverage | ~79% (304 tests) | Vitest / `docs/mvp-review.md` |
| Python library coverage | ~98% (74 tests) | pytest / `docs/mvp-review.md` |
| Backtest events / fired | 20 / 10 | report.json `totals` |
| Precision | **0.80** (TP 8, FP 2) | report.json |
| Recall | **0.889** (FN 1) | report.json |
| FP-rate | **0.20** | report.json |
| Brier (on `adverseLikelihood`) | **0.127** | report.json |
| Confidence distribution | {2:2, 3:6, 4:9, 5:3} — 4 distinct levels | report.json |
| Adverse rate — acute @5d / allocation @21d | 0.125 / 0.083 | report.json |

## 7. How to run

```bash
# Fast — every change (seconds, DB-free)
npm run validate:fast      # typecheck + vitest + pytest

# Full — the complete validation, pre-merge (brings up Postgres)
npm run validate:full      # Fast + e2e subset + quality-gate + backtest gate + backtest report
#   then, for full functional coverage:  /e2e-test   (agent-driven runbook)

# Deep — periodic audit (pre-release / nightly)
npm run validate:deep      # Full + 30-day smoke + robustness sweeps (TODO → §06)
```

The orchestrator (`scripts/validate.ts`) runs the tier's steps in order, stops at the first hard failure, prints
a per-step pass/fail table, and writes `scripts/out/validate-report.json` (exit code = first failure's code).
Full design in [§02](./02-validation-tiers.md); gates/baselines in [§08](./08-quality-gates-and-baselines.md).
Full functional e2e remains the **`/e2e-test`** skill over `.claude/e2e-tests.md` (authoritative); `validate`
shells only a small CLI subset of it.

---

**Out of scope here:** the real-time market-data provider comparison (Twelve Data / Finnhub vs Fugle) is a
separate research note, not part of this evaluation suite.
