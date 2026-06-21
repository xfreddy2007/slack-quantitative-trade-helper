# §05 — Recommendation / Paper Evaluation

> **Stub for discussion.** Validates that *paper recommendations* improve outcomes — distinct from
> alert/signal quality (§04). Parent: [README](./README.md).

## What it measures

Did a logged paper recommendation actually help? Two angles:

- **Return** over horizons — did the called move beat the alternative?
- **Allocation discipline** — did a rebalance move the portfolio *toward* its target (improved), leave it
  (unchanged), or push it *away* (worsened)?

Horizons: **5 / 21 / 63 / 120d** (event-driven → thesis-length), per PRD evaluation-horizon decision.

## Source of truth

Python evaluation library:

- `research/quant-python/src/investment_research/evaluation/returns.py`
- `research/quant-python/src/investment_research/evaluation/risk.py`
- `research/quant-python/src/investment_research/evaluation/discipline.py`

Functional coverage: **e2e Group 12** (`paper_recommendation` evaluation):

- 5d return from price path · allocation discipline improved/unchanged/worsened · eval row links back to the
  rec · `paper-log` shows eval status · pending when horizon not reached · defers on missing price.

## Role in the suite

Runs in the **Full** tier. The gate: discipline classification stays correct on fixtures, and evaluation
linkage/pending logic doesn't regress. Aggregate quality trends feed threshold tuning (T8.3.1).

## Open questions for discussion

- Is there an aggregate quality score to gate on, or only per-case correctness (Group 12)?
- Allocation-discipline eval needs allocation *history* snapshots (noted in `docs/mvp-review.md` as not yet
  populated) — does this section depend on that, or stay fixture-only for now?
- Relationship to the feedback loop (T8.3.1) — does paper-eval feed threshold tuning, and do we validate that loop?

## Links

- `research/quant-python/.../evaluation/{returns,risk,discipline}.py` · `.claude/e2e-tests.md` (Group 12) ·
  `docs/tasks/T8.3.1-feedback-loop-threshold-tuning/TASK.md`
