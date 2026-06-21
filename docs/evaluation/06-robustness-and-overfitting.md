# §06 — Robustness & Overfitting (Deep tier)

> **Stub for discussion. Phase 2 — net-new methodology.** This is the **Deep** lane: does the strategy hold
> up out-of-sample, or is it tuned to the fixtures? Parent: [README](./README.md).

## Why

With a small curated event set (20 events in 2025), it is easy to tune `scoreItem`/`checkThreshold` until the
backtest looks great — and have it mean nothing on unseen data. ~95% of backtested strategies fail live; the
defenses below are standard quant practice.

## Methods to build

- **Walk-forward / out-of-sample split.** Partition events/prices into in-sample (tune) and out-of-sample
  (validate only). Reserve 20–30%, never tune on it. Roll the window forward as the corpus grows.
- **Probability of Backtest Overfitting (PBO)** via Combinatorially Symmetric Cross-Validation (CSCV) —
  estimate the chance the "best" threshold config is overfit.
- **Deflated Sharpe Ratio** — correct the action-value Sharpe ([§04](./04-signal-quality-evaluation.md)) for
  multiple-testing selection bias and non-normal returns.
- **Threshold-sensitivity & parameter-stability sweeps** — perturb severity/confidence/relevance cutoffs and
  budget caps; a robust rule degrades *gracefully*, not off a cliff.

## Dependencies

- Needs a **larger / out-of-sample corpus** → ties to the live-history backfill track in
  [§07](./07-data-and-provider-validation.md). Curated 2025 fixtures alone are too small for a real holdout.
- Builds on §04's metric engine (extend, don't fork).

## Role in the suite

**Deep** tier only — pre-release / nightly, not per-change. Output is an overfitting audit report, not a
per-commit gate (initially).

## Open questions for discussion

- Minimum corpus size before walk-forward/PBO is meaningful? (20 events is too few)
- Build now as documentation-only, or defer code until §07's history track lands?
- Does any Deep metric eventually become a release-blocking gate, or stays advisory?

## Links

- `scripts/backtest-2025/run.ts` (metric engine to extend) · [§07](./07-data-and-provider-validation.md)
  (corpus) · [arXiv walk-forward](https://arxiv.org/html/2512.12924v1)
