# §04 — Signal-Quality Evaluation

> **Stub for discussion.** Turns the existing backtest from a *report* into a *regression gate*, and adds
> Information Coefficient. Parent: [README](./README.md).

## Source of truth

`scripts/backtest-2025/run.ts` reuses the **live app judgment** (`scoreItem`, `checkThreshold`, `checkBudget`)
against curated 2025 events + reconstructed price paths, then scores the app's calls against actual forward
outcomes. Window-agnostic via env (`BT_HORIZONS`, `BT_ADVERSE_HORIZON`, `BT_ACUTE_HORIZON`, …). Output:
`scripts/backtest-2025/out/report.json`. Short variant: `scripts/backtest-30d/`.

## Metrics produced today

- Confusion matrix → **precision, recall, FP-rate**
- **Brier** on `adverseLikelihood` (calibration buckets)
- **Confidence distribution** (source-reliability, must stay graduated ≥3 levels)
- **Adverse rate** by horizon class (acute @5d / allocation @21d) and per category
- **Action value** on `reduce_position`: drawdown avoided, Sharpe, helped/hurt

## To add

- **Information Coefficient (IC)** — rank correlation of signal strength vs forward return; complements
  precision/recall by measuring *graded* predictive power, not just binary hit/miss.

## From report → regression gate

1. Freeze current `report.json` numbers as the **golden baseline** (registry in [§08](./08-quality-gates-and-baselines.md)).
2. `run.ts` (or a wrapper) **exits non-zero** when a gated metric regresses beyond tolerance.
3. Determinism: fixed fixtures, no wall-clock/network in scoring, stable ordering.

### Candidate gated thresholds (baseline → floor)

| Metric | Baseline | Proposed gate |
|--------|----------|---------------|
| precision | 0.80 | ≥ 0.75 |
| recall | 0.889 | ≥ 0.80 |
| FP-rate | 0.20 | ≤ 0.30 |
| Brier | 0.127 | ≤ 0.18 |
| distinct confidence levels | 4 | ≥ 3 |

## Open questions for discussion

- Hard floors (above) vs "no worse than baseline − epsilon"?
- Gate on the 20-event 2025 set, the 30d set, or both?
- IC threshold — set now or observe a few runs first?
- Where does the threshold check live — inside `run.ts` or a separate `assertBaseline.ts`?

## Links

- `scripts/backtest-2025/run.ts` · `scripts/backtest-2025/out/report.json` ·
  `docs/features/feature-trigger-quality-fixes/tasks.md`
