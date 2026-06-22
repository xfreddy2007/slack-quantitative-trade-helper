# §04 — Signal-Quality Evaluation

> **Decided spec** (was a discussion stub). Turns the backtest from a *report* into a *regression gate* via a
> ratchet against a versioned baseline registry, and adds the Information Coefficient (report-only for now).
> Registry + policy live in [§08](./08-quality-gates-and-baselines.md). Parent: [README](./README.md).

## Source of truth

`scripts/backtest-2025/run.ts` reuses the **live app judgment** (`scoreItem`, `checkThreshold`, `checkBudget`)
against curated 2025 events + reconstructed price paths, then scores the app's calls against actual forward
outcomes. Window-agnostic via env (`BT_HORIZONS`, `BT_ADVERSE_HORIZON`, `BT_ACUTE_HORIZON`, …). Output:
`scripts/backtest-2025/out/report.json`. Short smoke variant: `scripts/backtest-30d/` (own `out/report.json`).

`run.ts` stays **report-only** — it always exits 0 and never gates. The gate is a separate reader
(`scripts/assertBaseline.ts`) so the report generator and the pass/fail policy stay decoupled.

## Metrics produced

- Confusion matrix → **precision, recall, FP-rate** (`totals.*`)
- **Brier** on `adverseLikelihood` (calibration buckets)
- **Confidence distribution** (source reliability; must stay graduated, `distinctConfidenceLevels`)
- **Adverse rate** by horizon class (acute @5d / allocation @21d) and per category
- **Action value** on `reduce_position`: drawdown avoided, Sharpe, helped/hurt
- **Information Coefficient (IC)** — *new this round* — see below

## Information Coefficient (report-only)

IC measures *graded* predictive power, complementing the binary hit/miss of precision/recall. `run.ts` computes:

```
ic.spearman = Spearman( adverseLikelihood , -ret@evalHorizon )   # over all outcomes with a valid fwd return
```

Rank-correlation of the model's predicted adverse-likelihood against the **realized adverse magnitude**
(`-ret`, so larger = worse outcome). **Positive IC = good**: higher predicted adverse-likelihood ranks with
worse realized outcomes. Implementation: average-rank ties + Pearson on ranks (`run.ts`).

**Deferred — observe before gating.** IC is emitted to `report.json` (`ic` block) and the console, but is **not**
in the gated set. Current observed values: **2025 = 0.141 (n=20)**, **30d = 0.081 (n=13)** — weak-positive,
right sign, tiny sample. Watch its range over several runs, then set a floor in `baselines.json` once stable.

## From report → regression gate (ratchet)

The gate is a **ratchet**, not a fixed hard floor (decision this round):

> A change may **not** push any gated metric past **`baseline ± epsilon`** for its direction.
> `higher`-is-better metrics fail when `actual < baseline − epsilon`; `lower`-is-better fail when
> `actual > baseline + epsilon`.

Epsilon absorbs small-sample noise (one event flipping ≈ 0.1 swing on the 20-event set). Lowering a baseline is
an **explicit, reviewed** edit to the registry with a rationale — never a silent ratchet-down (policy in §08).

**Determinism:** fixed fixtures, no wall-clock/network in scoring, stable ordering → identical `report.json`
across runs, so the gate is reproducible.

### Gated metrics & ratchet floors

Both event sets gate against **their own** baselines (the 30d smoke set is weaker by design — the ratchet only
guards it against large regression, it does **not** demand the full-year numbers).

| Metric | dir | 2025 base → floor (ε) | 30d base → floor (ε) |
|--------|-----|------------------------|-----------------------|
| precision | higher | 0.80 → **0.70** (0.10) | 0.556 → 0.456 (0.10) |
| recall | higher | 0.889 → **0.769** (0.12) | 0.625 → 0.505 (0.12) |
| FP-rate | lower | 0.20 → **≤0.35** (0.15) | 0.444 → ≤0.594 (0.15) |
| Brier | lower | 0.127 → **≤0.177** (0.05) | 0.200 → ≤0.250 (0.05) |
| distinct confidence levels | higher | 4 → **≥3** (1) | 3 → ≥2 (1) |

These ε land the ratchet floors ≈ the hand-intuited hard floors from the first draft (precision ~0.75, Brier
~0.18, distinct ≥3) — a sanity check that ε is sized right, not arbitrary.

## The gate — `scripts/assertBaseline.ts`

```bash
npx tsx scripts/assertBaseline.ts 2025-full-year   # exit 0 = within tolerance, 1 = regression
npx tsx scripts/assertBaseline.ts 30d-smoke
```

Reads `docs/evaluation/baselines.json` (the registry), digs each gated metric out of the set's `report.json` by
its dotted `path` (e.g. `totals.precision`), applies the ratchet, prints a per-metric PASS/FAIL table, and exits
non-zero on the first regression. A missing/justified change is handled by editing the registry (see §08).

### Wired into the orchestrator ([§02](./02-validation-tiers.md))

Each gate runs **after** its report step (the report regenerates `report.json` first):

| tier | sequence |
|------|----------|
| **Full** | `backtest-report` (report) → `backtest-baseline` (**gate**, 2025 set) |
| **Deep** | + `backtest-30d` (report) → `backtest-30d-baseline` (**gate**, 30d set) |

The pre-existing `backtest-gate` (`backtest:fixtures`, an `apps/slack-bot` FP-rate fixture check) is orthogonal
and stays — it gates a different fixture set from the `scripts/backtest-2025` signal-quality report.

## Resolved decisions

- **Ratchet (baseline − ε), not fixed hard floors** — catches drift while tolerating one-event noise.
- **Gate both sets** (2025 + 30d), each against its own registry baseline.
- **IC deferred** — report-only until its stable range is known, then gate.
- **Gate lives in a separate `assertBaseline.ts`**, not inside `run.ts` — keeps the generator report-only.

## Links

- `scripts/backtest-2025/run.ts` · `scripts/assertBaseline.ts` · `docs/evaluation/baselines.json`
- [§08](./08-quality-gates-and-baselines.md) (registry + regression policy) · [§02](./02-validation-tiers.md)
  (orchestrator) · [§09](./09-metrics-glossary.md) (metric definitions)
