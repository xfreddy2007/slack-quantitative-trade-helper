# §08 — Quality Gates & Baselines

> **Decided spec** (was a discussion stub). Defines the baseline registry, the regression policy, and the run
> procedure. The signal-quality gate itself is built in [§04](./04-signal-quality-evaluation.md); this section
> owns the **registry format and the rules** around it. Parent: [README](./README.md).

## Today vs target

`apps/slack-bot/src/orchestration/qualityGate.ts` is a 3-step fixture-pipeline check (pipeline runs → records
created → render has 今日觀察 / 可考慮調整 / 不建議動作). It stays as the **render/pipeline gate** (the
`quality-gate` step in [§02](./02-validation-tiers.md)). It is **not** a regression gate and is not extended into
one — the regression gate is the separate, registry-driven `assertBaseline.ts` (§04). Together they cover two
different failure classes: render/pipeline breakage vs signal-quality degradation.

## Baseline registry — `docs/evaluation/baselines.json`

A single versioned JSON is the source of truth for every gated number. Shape:

```jsonc
{
  "version": 1, "updated": "2026-06-22", "policy": "ratchet",
  "sets": {
    "2025-full-year": {
      "report": "scripts/backtest-2025/out/report.json", "events": 20,
      "metrics": {
        "precision": { "path": "totals.precision", "baseline": 0.80, "direction": "higher", "epsilon": 0.10, "gated": true },
        // … recall, fpRate, brier, distinctConfidenceLevels
      }
    },
    "30d-smoke": { "report": "scripts/backtest-30d/out/report.json", "events": 13, "metrics": { … } }
  },
  "coverage": { "tsUnitLineCoverage": { "baseline": 0.79, …, "gated": false }, "pythonLibraryCoverage": { …, "gated": false } }
}
```

Per-metric fields: **`path`** (dotted accessor into `report.json`), **`baseline`**, **`direction`**
(`higher`|`lower`), **`epsilon`** (noise tolerance), **`gated`** (enforced now, or registry-only). `assertBaseline.ts`
enforces only `gated: true` metrics; `gated: false` rows document a target without enforcing it yet.

### Registry contents (this round)

| Set | Metrics gated | Source |
|-----|---------------|--------|
| `2025-full-year` | precision, recall, fpRate, brier, distinctConfidenceLevels | `backtest-2025/out/report.json` |
| `30d-smoke` | same five (own weaker baselines) | `backtest-30d/out/report.json` |
| `coverage` | tsUnitLineCoverage, pythonLibraryCoverage — **registry-only (`gated:false`)** | `docs/mvp-review.md` |

Ratchet floors are tabulated in [§04](./04-signal-quality-evaluation.md). Coverage stays report-only this round:
no coverage-extraction step is wired (vitest/pytest don't emit a parsed number to the gate yet) — wiring it is a
later step, so enforcing now would be brittle. The baselines are recorded so the target is explicit.

## Regression policy

- A change may **not** push any gated metric past its ratchet bound (`baseline ± epsilon`, by direction).
- **Lowering a baseline** is an **explicit, reviewed edit** to `baselines.json` with a one-line rationale in the
  commit / the entry's `_comment` — never a silent ratchet-down to make a red gate green.
- **Improvements may ratchet a baseline up** (and tighten ε) to lock in gains.
- **Epsilon is the noise budget, not slack to spend** — it exists so single-event sampling noise on small sets
  doesn't trip the gate; it is not headroom for quality to drift down into.

## Run procedure (agent / human)

1. Make the change.
2. **Fast** — `npm run validate:fast` (static + unit, DB-free).
3. **Full** — `npm run validate:full` (orchestrator: brings up DB, render gate, **`backtest-baseline`**) then
   `/e2e-test` for the agent-driven functional remainder.
4. Read the pass/fail table + `scripts/out/validate-report.json`. Any red → fix, or justify a baseline edit.
5. **Deep** before release — `npm run validate:deep` (adds `backtest-30d-baseline` + robustness TODO → §06).

**Output contract:** per-step PASS/FAIL table + machine-readable `validate-report.json` (§02); the baseline gate
adds its own per-metric table and exits non-zero on regression.

## Resolved decisions

- **Registry = `baselines.json`** (versioned JSON), not a markdown table or assertions buried in `run.ts`.
- **New orchestrator calls the gate as one step** (`assertBaseline.ts`); `qualityGate.ts` is **not** expanded.
- **Coverage gates: registry-only for now** (`gated:false`) to avoid brittleness until extraction is wired.

## Links

- `docs/evaluation/baselines.json` · `scripts/assertBaseline.ts` · `apps/slack-bot/src/orchestration/qualityGate.ts`
- [§04](./04-signal-quality-evaluation.md) (gate build + ratchet floors) · [§02](./02-validation-tiers.md)
  (orchestrator) · [§09](./09-metrics-glossary.md) (metric definitions)
