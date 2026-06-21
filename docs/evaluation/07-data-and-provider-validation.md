# §07 — Data & Provider Validation

> **Stub for discussion.** Validates the data layer: adapter contracts, provider-failure isolation, fixture
> governance, and the path to a live out-of-sample corpus. Parent: [README](./README.md).

## Two concerns

1. **Provider correctness & resilience** — adapters normalize correctly and a provider failure is *isolated*,
   not pipeline-fatal.
2. **Corpus quality** — the fixtures we validate against are representative, governed, and growing toward a
   real out-of-sample holdout.

## Provider correctness & resilience

Covered by **e2e Group 11** (provider failure isolation):

- adapter parses mock fixture → normalized records · rate-limit guard (daily cap, UTC reset) ·
  500/network/timeout → status recorded, commands keep working · FinMind 401 → `auth_failed`;
  all Taiwan providers down → `all_failed`.

Mechanism: the `runIsolated` boundary records a `provider_runs` status instead of throwing. New adapters must
ship a contract test (parse fixture → normalized shape) + a failure-isolation test, mirroring
`providers/alpha-vantage.ts` / `providers/finmind.ts`.

## Corpus governance

Fixtures live under `packages/fixtures/` (`portfolios`, `prices`, `news`, `provider-payloads`, `broker`,
`backtest`) and `scripts/backtest-2025|30d/{events,prices}.json`.

- **Provenance** — each curated event keeps `source_url` + ground-truth `expected_alert`.
- **Expansion** — grow the event set over time; label new events without leaking them into tuning.
- **Freshness** — schema-validate fixtures so silent drift fails loudly (Group 1 malformed-fixture test).

## Live out-of-sample track (new)

Plan a path to ingest **real provider history** (TW + US) as a true out-of-sample corpus for walk-forward /
PBO ([§06](./06-robustness-and-overfitting.md)). Constraint (per memory): current providers can't fetch deep
history → needs a backfill source/strategy. Separate from the real-time-provider research note.

## Open questions for discussion

- Backfill source for history? (provider with history endpoint vs archived vendor dump)
- Keep curated fixtures as the deterministic regression corpus **and** add live history as the holdout — two
  corpora, two purposes — confirm?
- Contract-test harness: shared helper vs per-adapter bespoke?

## Links

- `.claude/e2e-tests.md` (Group 11) · `apps/slack-bot/src/providers/` · `packages/fixtures/` ·
  `docs/tasks/T6.2.1-provider-failure-isolation-scheduler/TASK.md`
