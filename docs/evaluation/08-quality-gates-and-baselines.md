# §08 — Quality Gates & Baselines

> **Stub for discussion.** Defines pass/fail, the baseline registry, the regression policy, and the run
> procedure. Supersedes the thin `qualityGate.ts`. Parent: [README](./README.md).

## Today vs target

`apps/slack-bot/src/orchestration/qualityGate.ts` is a 3-step fixture-pipeline check (pipeline runs → records
created → render has 今日觀察 / 可考慮調整 / 不建議動作). Useful but **not a regression gate** — it never
compares quality metrics to a baseline. Target: a real gate that fails on degradation across all Full-tier
layers.

## Baseline registry

A single versioned source of truth for every gated number (proposed: `docs/evaluation/baselines.json` or a
table here). Seeded from the §README snapshot:

| Metric | Baseline | Gate (proposed) |
|--------|----------|-----------------|
| precision | 0.80 | ≥ 0.75 |
| recall | 0.889 | ≥ 0.80 |
| FP-rate | 0.20 | ≤ 0.30 |
| Brier | 0.127 | ≤ 0.18 |
| distinct confidence levels | 4 | ≥ 3 |
| TS unit coverage | ~79% | ≥ 78% |
| Python coverage | ~98% | ≥ 95% |

## Regression policy

- A change may **not** push any gated metric past its threshold.
- Lowering a baseline is an **explicit, reviewed** edit to the registry with a one-line rationale — never a
  silent ratchet-down.
- Improvements may raise a baseline (ratchet-up) to lock in gains.

## Run procedure (agent / human)

1. Make change. 2. Run **Fast** (static + unit). 3. Run **Full** (orchestrator [§02](./02-validation-tiers.md)
   + `/e2e`). 4. Read the pass/fail table; any red → fix or justify a baseline change. 5. **Deep** before
   release ([§06](./06-robustness-and-overfitting.md)).

Output contract: a per-layer pass/fail table + machine-readable JSON summary the agent can parse.

## Open questions for discussion

- Registry format — `baselines.json` vs markdown table vs assertions in `run.ts`?
- Does the gate **expand** `qualityGate.ts` or a new `validate.ts` calls it as one step? (lean: new orchestrator)
- Coverage gates: enforce, or report-only to avoid brittleness?

## Links

- `apps/slack-bot/src/orchestration/qualityGate.ts` · `scripts/backtest-2025/out/report.json` ·
  [§04](./04-signal-quality-evaluation.md) · [§09](./09-metrics-glossary.md)
