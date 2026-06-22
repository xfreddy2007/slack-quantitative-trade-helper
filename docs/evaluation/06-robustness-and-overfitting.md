# §06 — Robustness & Overfitting (Deep tier)

> **Decided spec** (was a discussion stub). The **Deep** lane: does the rule hold up, or is it tuned to the
> fixtures? Built as a **report-only audit** (`scripts/robustness/run.ts`) — never gates. Parent:
> [README](./README.md).

## The honest framing

The app has **no fitted parameters** — `scoreItem` / `checkThreshold` are fixed rules, not a model trained on
the fixtures. So classic ML "train on X, validate on holdout Y" doesn't directly apply: there's nothing fitted
to overfit. The real overfitting risk is the **threshold cutoffs** (severity ≥ 4, confidence ≥ 3, relevance ≥ 3)
— the knobs a human could have hand-tuned until the 20-event backtest looked good. So the audit probes those
directly rather than faking statistical rigor on a set too small for it.

## What the confusion matrix depends on

precision / recall / FP-rate depend **only** on `(fired, expected_alert)`. `fired` = `scoreItem` →
`checkThreshold(cutoffs)` → `checkBudget`. **No price paths are needed** for these metrics, so the harness reuses
the live functions and mirrors only the ~15-line budget-aware decision loop. A **self-check** asserts the
baseline config reproduces the canonical `report.json` confusion matrix (TP8/FP2/TN9/FN1) — if the mirror ever
drifts from production, the audit says so loudly.

`checkThreshold` was given **optional cutoff params** (default = production values) so the sweep perturbs one
shared rule instead of forking it. Passing no cutoffs reproduces production exactly (all 328 TS tests green).

## Analyses built

### 1. Threshold-sensitivity sweep — the core overfitting probe

Perturb each cutoff ±1 (severity {3,4,5}, confidence {2,3,4}, relevance {2,3,4}), hold the others at default,
recompute the confusion matrix. A robust rule degrades **gracefully**; a **cliff** means the result hinges on
the exact cutoff (a fixture-tuning smell).

**Primary vs secondary knobs.** Severity is the *decisive filter by design* — a big swing when you move it is
expected, not evidence of overfit. Hidden fixture-tuning would surface in the **secondary** knobs (confidence /
relevance), so the advisory `stability` label is graded on **those**; severity's swing is reported but not
graded.

Current findings (2025 20-event set):

| Knob | precision range | recall range | read |
|------|-----------------|--------------|------|
| severity (primary) | 44% → 80% → **100%** | 89% → 89% → 33% | decisive filter; baseline (4) sits between a FP-flood (3) and a recall-collapse (5) |
| confidence | 71% → 80% → 82% | **56% → 89% → 100%** | recall is fragile to this cutoff |
| relevance | 78% → 80% | 78% → 89% | near-flat — robust |

→ `stability: SENSITIVE` (max secondary swing = **recall 44%** via the confidence cutoff > 25% tolerance). A
specific, honest finding: **recall hinges on the confidence threshold**. The full 3×3×3 grid envelope
(minPrecision 42%, maxFP 58%) bounds the worst corners.

### 2. Walk-forward temporal split (report-only, N-warned)

70/30 chronological split → confusion matrix on the early in-sample slice vs the late out-of-sample slice. With
no fitted params this is a **temporal-stability** check, **not** train/validate. Current: in-sample (n=14)
precision 78% / recall 88%; out-of-sample (n=6) precision 100% / recall 100% — but emitted with an explicit
**insufficient-N warning** (6 < 10): indicative only, not statistically meaningful.

### 3. PBO (CSCV) + deflated Sharpe — deferred

Probability of Backtest Overfitting via combinatorially symmetric cross-validation, and a multiple-testing /
non-normality correction to the action-value Sharpe ([§04](./04-signal-quality-evaluation.md)). **Deferred** —
recorded in the report as `status: "deferred"`. N=20 is too small for CSCV or selection-bias correction to mean
anything; these land when the **live-history corpus** ([§07](./07-data-and-provider-validation.md)) provides a
real out-of-sample set.

## Role in the suite

**Deep tier only**, **report-only** (matches the stub's stated intent: "an overfitting audit report, not a
per-commit gate"). Wired into the orchestrator ([§02](./02-validation-tiers.md)) as the `robustness` step:

```bash
npx tsx scripts/robustness/run.ts          # 2025 set; writes scripts/robustness/out/report.json
BT_DATA_DIR=scripts/backtest-30d npx tsx scripts/robustness/run.ts
```

Always exits 0; a self-check failure is surfaced in the report/console, not as a gate. (Promoting any finding to
a release-blocking gate is deferred until the §07 corpus makes the signal trustworthy.)

## Resolved decisions

- **Report-only audit**, Deep tier — never gates (revisit once §07 corpus lands).
- **Build sensitivity sweep + walk-forward smoke now**; **defer PBO / deflated Sharpe** to §07 (no faked rigor).
- **Parameterize `checkThreshold`** (optional cutoffs, defaults preserved) — one shared rule, no forked copy.
- **Stability graded on secondary knobs only** — severity is the intended decisive filter, not an overfit signal.

## Links

- `scripts/robustness/run.ts` · `apps/slack-bot/src/orchestration/alertThreshold.ts` (parameterized) ·
  `scripts/backtest-2025/run.ts` (canonical report for the self-check)
- [§04](./04-signal-quality-evaluation.md) (metric engine) · [§07](./07-data-and-provider-validation.md)
  (corpus for PBO/DSR) · [§02](./02-validation-tiers.md) (orchestrator) · [arXiv walk-forward](https://arxiv.org/html/2512.12924v1)
