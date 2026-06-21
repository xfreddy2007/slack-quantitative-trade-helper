# §09 — Metrics Glossary

> **Stub for discussion.** Reference for every metric in the suite: definition, formula, current value.
> Current values from `scripts/backtest-2025/out/report.json` (2025 full-year). Parent: [README](./README.md).

## Signal-quality (classification)

| Metric | Definition / formula | Current |
|--------|----------------------|---------|
| Precision | TP / (TP + FP) — of fired alerts, fraction correct | **0.80** (8/10) |
| Recall | TP / (TP + FN) — of true events, fraction caught | **0.889** (8/9) |
| FP-rate | FP / total fired | **0.20** |
| Confusion matrix | TP / FP / TN / FN vs ground-truth `expected_alert` | 8 / 2 / 9 / 1 (20 events) |

## Calibration & confidence

| Metric | Definition | Current |
|--------|------------|---------|
| `adverseLikelihood` | predicted P(adverse move within class horizon), 0–1 — the calibrated field | per-event |
| Brier score | mean( (adverseLikelihood − actual)² ) — lower = better calibrated | **0.127** |
| `confidence` | **source reliability** 1–5 (distinct from severity/probability) | dist {2:2,3:6,4:9,5:3} |
| Distinct confidence levels | count of levels used (graduation guard) | **4** |

## Outcome / horizon

| Metric | Definition | Current |
|--------|------------|---------|
| Adverse rate (acute) | fraction of acute signals adverse within **5d** | 0.125 (n=8) |
| Adverse rate (allocation) | fraction adverse within **21d** | 0.083 (n=12) |
| Horizons | return windows evaluated | 5 / 21 / 63d (paper-eval also 120d) |

## Action value (on `reduce_position`)

| Metric | Definition |
|--------|------------|
| Drawdown avoided | −(return within eval horizon) for acted signals |
| Sharpe (action) | mean avoided / std avoided |
| Helped / hurt | count of acted signals with positive / negative actual outcome |

## Paper-recommendation eval ([§05](./05-recommendation-paper-eval.md))

| Metric | Definition |
|--------|------------|
| Return @ horizon | realized return of the recommended move (5/21/63/120d) |
| Allocation discipline | improved / unchanged / worsened vs target |

## Robustness ([§06](./06-robustness-and-overfitting.md), Deep)

| Metric | Definition |
|--------|------------|
| Information Coefficient (IC) | rank corr of signal strength vs forward return |
| PBO | Probability of Backtest Overfitting (CSCV) |
| Deflated Sharpe | Sharpe corrected for multiple-testing selection bias |

## Coverage

| Metric | Current |
|--------|---------|
| TS unit line coverage | ~79% (304 tests) |
| Python library coverage | ~98% (74 tests) |

## Links

- `scripts/backtest-2025/run.ts` · `scripts/backtest-2025/out/report.json` ·
  `docs/features/feature-trigger-quality-fixes/tasks.md`
