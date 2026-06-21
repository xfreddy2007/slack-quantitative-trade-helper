# §01 — Validation Philosophy & Threat Model

> **Stub for discussion.** Defines *what we are defending against* and the principles every other section
> inherits. Parent: [README](./README.md).

## Why validate at all

This is a money-adjacent advisory system. A regression isn't a cosmetic bug — it can mean a bad
`reduce_position` call on bullish news, a missed crash alert, or a confidently-wrong confidence score.
Validation exists to make every change prove it did **not** degrade correctness, signal quality, or robustness.

## The five regression classes

1. **Functional** — a command crashes, a DB row isn't written, an idempotent job double-writes.
   Defended by unit tests + functional e2e ([§03](./03-functional-e2e.md)).
2. **Signal-quality** — precision, recall, calibration (Brier), or action-value drift below baseline even
   though nothing "crashes". Defended by the backtest regression gate ([§04](./04-signal-quality-evaluation.md)).
3. **Overfitting** — rules tuned to look great on the curated fixtures but fail on unseen data. Defended by
   walk-forward / out-of-sample / PBO ([§06](./06-robustness-and-overfitting.md)).
4. **Data / provider** — an adapter's contract drifts, or a provider fails silently and corrupts the pipeline.
   Defended by contract tests + failure isolation ([§07](./07-data-and-provider-validation.md)).
5. **Render / UX** — the Slack render drops a required Traditional-Chinese section (今日觀察 / 可考慮調整 /
   不建議動作) or the paper-only disclaimer. Defended by render assertions (`qualityGate.ts`, Group 0B/8).

## Principles (inherited by all sections)

- **Determinism first.** Regression checks compare against an approved golden baseline with fixed seeds and
  frozen fixtures. Non-determinism is a bug, not noise to tolerate.
- **Out-of-sample discipline.** Never tune thresholds on the holdout. Reserve a portion of events/prices for
  validation only ([§06](./06-robustness-and-overfitting.md)).
- **Buy/sell asymmetry.** "Act" signals (reduce/add) favor **precision** (don't cry wolf); protective signals
  favor **recall** (don't miss a real shock). The 2025-04-07 TAIEX −10% FN is the canonical recall failure.
- **Baseline-or-better.** A change may not lower any gated metric below its registered baseline without an
  explicit, documented baseline update ([§08](./08-quality-gates-and-baselines.md)).

## Open questions for discussion

- Are all five classes gated in **Full**, or is overfitting (#3) **Deep**-only? (current lean: #3 = Deep)
- Tolerance bands: exact-match golden vs ±epsilon per metric?
- Who/what authorizes a baseline change, and how is it recorded?

## Links

- `.claude/e2e-tests.md` · `scripts/backtest-2025/run.ts` · `apps/slack-bot/src/orchestration/qualityGate.ts`
