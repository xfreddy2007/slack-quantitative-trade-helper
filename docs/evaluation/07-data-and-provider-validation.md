# §07 — Data & Provider Validation

> **Decided spec** (was a discussion stub). Two concerns: provider correctness/resilience (already covered) and
> corpus quality — including a new real-data **out-of-sample holdout** built this round. Parent:
> [README](./README.md).

## 1. Provider correctness & resilience — already covered

No new build this round; the layer is already validated:

- **Failure isolation** — `runIsolated` (`apps/slack-bot/src/providers/failureBoundary.ts`) records a
  `provider_runs` status instead of throwing: `success | rate_limit | auth_failed | all_failed | timeout |
  failed`. A provider outage never breaks a command.
- **Contract tests** — per-adapter (`tests/providers/{finmind,alphaVantage,providers}.test.ts`) validate parsed
  output against the **shared Zod schemas** (`@schemas/zod` — `PriceSnapshotFixtureSchema`, `NewsFixtureSchema`).
  The schemas are the shared contract; the per-adapter tests are the bespoke part.
- **Fixture schema validation** — `tests/fixtures/fixtures.test.ts` Zod-parses every fixture, so malformed data
  fails loudly. This runs inside `ts-unit`, so it is **already gated** by Fast/Full ([§02](./02-validation-tiers.md)).
- **e2e Group 11** — provider failure-isolation scenarios (rate-limit, 500/timeout, FinMind 401 → `auth_failed`,
  all-TW-down → `all_failed`).

**Resolved:** the contract pattern stays *shared Zod schema + per-adapter test*. A single shared contract-test
helper is an optional future refactor, not warranted yet (3 real adapters).

## 2. Corpus quality — the two-corpora model

Confirmed this round: **two corpora, two purposes.**

| Corpus | Prices | Role | Determinism |
|--------|--------|------|-------------|
| `scripts/backtest-2025/` (+ `backtest-30d/`) | memory-**reconstructed** (approximate, knowledge-cutoff) | **regression** set — the §04 ratchet baselines are frozen against it | fully deterministic |
| `scripts/backtest-holdout/` | **real** TW EOD (FinMind) + reconstructed VOO + synthetic cash | **out-of-sample holdout** — same labeled events, real prices | frozen snapshot |

The holdout reuses the **same `events.json`** (same ground-truth labels) — only the prices are real. So it is
out-of-sample *for prices*, not for labels. The §04 baselines are **never** set from the holdout (real data is
non-deterministic to regenerate; that's why it's a holdout, not the gate).

## 3. Live-history backfill — `scripts/backfill/history.ts`

Pulls real EOD closes into the frozen holdout corpus + a `provenance.json` manifest (source/endpoint/row-count
per symbol, fetch timestamp). Network + tokens from `.env` (minimal parser).

```bash
npx tsx scripts/backfill/history.ts        # writes scripts/backtest-holdout/{prices,events,provenance}.json
```

| Symbol | Source | Result |
|--------|--------|--------|
| 0050.TW, 2330.TW | **FinMind** `TaiwanStockPrice` (date-ranged) | ✅ real — 293 / 298 rows, 2025-01-02 .. 2026-03-31 |
| VOO | Alpha Vantage `TIME_SERIES_DAILY` | ❌ **blocked** — `outputsize=full` is now a *premium* feature; free `compact` (~100 days) can't reach 2025. Falls back to **reconstructed carryover**, flagged in provenance. |
| cash | synthetic | constant 1.0 over the union of trading dates |

> **FinMind's 7-day cap is app-side** (`LOOKBACK_DAYS` in the alert adapter), not an API limit — the backfill
> script passes a wide `start_date`/`end_date` directly and gets deep history. **US real history needs a non-AV
> free source** (Twelve Data free 800/day or Finnhub free both have daily history) — TODO, see the realtime
> provider research note.

## 4. Holdout finding (the validation payoff)

Running the backtest on the holdout (real TW prices, same labels) vs the reconstructed regression set:

- **precision / recall / FP-rate are identical by construction** — they depend only on `(fired,
  expected_alert)`, which is price-independent (driven by event metadata, not returns).
- **Price-dependent metrics (adverse-rate, Brier) are also identical** — *despite materially different returns*.
  E.g. `2025-01-deepseek` 2330.TW: real `r5=0.0%` vs reconstructed `8.9%`; `tw-limitdown` 0050.TW: real `3.3%`
  vs `11.8%`. The reconstruction over-stated some magnitudes but **never flipped a −5% adverse verdict**.

→ The reconstructed corpus is **directionally faithful enough** that real TW prices change no signal-quality
conclusion. That's exactly what an out-of-sample holdout is for: it validates the cheap deterministic corpus.

## 5. Wired into the orchestrator

Deep tier gains a report-only **`holdout-report`** step (`BT_DATA_DIR=scripts/backtest-holdout`), run against the
**frozen committed corpus** — deterministic, no network. It surfaces the real-vs-reconstructed comparison in
every Deep run. The backfill script itself is **manual** (network-dependent); its output is committed frozen.

## Resolved decisions

- **Two corpora** — reconstructed = deterministic regression (gated); real = out-of-sample holdout (report-only).
- **FinMind for TW real history** (works); **US real history deferred** to a non-AV free source (AV `full` is
  premium). VOO carried reconstructed meanwhile, honestly flagged in provenance.
- **Contract pattern stays** shared-schema + per-adapter; no shared helper this round.
- **Holdout is report-only** — never a gate (real data isn't deterministically reproducible).

## Unblocks / follow-ons

- A US real-history source (Twelve Data / Finnhub) completes the real holdout → then **§06's deferred PBO /
  deflated Sharpe** become meaningful on a larger real OOS corpus.
- Expanding the labeled event set (new events, no tuning leak) grows the holdout toward a true label-OOS set.

## Links

- `scripts/backfill/history.ts` · `scripts/backtest-holdout/` (frozen corpus) ·
  `apps/slack-bot/src/providers/` · `failureBoundary.ts` · `tests/fixtures/fixtures.test.ts`
- [§06](./06-robustness-and-overfitting.md) (PBO/DSR awaiting this corpus) · [§04](./04-signal-quality-evaluation.md)
  (regression baselines) · `docs/realtime-provider-research.md` (US source options)
