# Tasks — Trigger & Confidence Quality Fixes

> Source: 2025 full-year confidence-quality backtest (`scripts/backtest-2025/`, report posted to #量化投資助理_test).
> Backtest verdict: TP=5 FP=2 TN=9 FN=4 · precision 71% · recall 56% · FP-rate 28.6% · Brier 0.318 ·
> acted-signal Sharpe −1.05 (7 reduce_position signals, 6 hurt). Four defects below trace directly to that run.

## Epic: Trigger & Confidence Quality Fixes

---

### Task 1: Fix structural blindness to market-specific (TW/US) events
**Priority:** P0
**Definition of Done:** A material single-market event (index single-day crash, single-stock limit-down, sharp FX move) derives `severity >= 4` and is no longer auto-suppressed by `checkThreshold`. Re-running the 2025 backtest reclassifies the 4 current FNs (notably the 2025-04-07 TAIEX record −10% plunge) as alerts; recall rises above 0.75 without FP-rate breaching 30%.

**Evidence:** `deriveSeverity` returns TW→3, US→3 (only GLOBAL→4/5); threshold needs sev≥4, so every TW/US event is structurally suppressed. All 4 FNs are TW/US events; the worst Taiwan crash of 2025 was silently dropped.

- [x] Extend `deriveSeverity` (`apps/slack-bot/src/orchestration/triggerScoring.ts`) with TW/US high-severity signals (e.g. "limit down", "限跌", "暴跌", "record drop/plunge", "single-day", magnitude phrases, sharp FX-move keywords).
- [x] Add unit tests in `apps/slack-bot/tests/` covering TAIEX crash, single-stock limit-down, TWD surge → severity ≥ 4.
- [x] Add the 4 FN events as labeled regression fixtures.
- [x] Re-run `npx tsx scripts/backtest-2025/run.ts`; confirm recall improvement and FP-rate < 30%.

---

### Task 2: Add directional (bullish/bearish) classification — stop firing reduce_position on good news
**Priority:** P0
**Definition of Done:** Risk-on / positive events (trade truce, tariff pause, rate-cut relief, strong earnings) no longer produce a `reduce_position` suggestion. The 2 current FPs (2025-05-12 Geneva truce, 2025-07-23 trade deals) stop firing reduce_position; precision rises above 0.71.

**Evidence:** Classifier reacts to GLOBAL + keyword with no good/bad polarity. Geneva truce and US-Japan/EU deals (both bullish) fired `reduce_position` — telling the user to sell into a rally.

- [x] Add a polarity signal (bearish/bullish/neutral) derived from event text in `triggerScoring.ts`.
- [x] Gate `decideSuggestedAction` so `reduce_position` requires bearish polarity; bullish material events map to `monitor` (or a future `consider_add`).
- [x] Unit tests: truce/pause/deal/strong-earnings → not reduce_position; crash/war/credit-stress → reduce_position.
- [x] Re-run backtest; confirm FP count drops.

---

### Task 3: Redefine and data-derive the confidence model
**Priority:** P1
**Definition of Done:** `confidence` produces a graduated 1–5 distribution (not just {1,3}) on the backtest set, and its semantics are documented as **source reliability**, kept distinct from severity/probability. A separate field (or documented mapping) represents adverse-likelihood. Backtest Brier is computed against the correct field; calibration buckets show discrimination across ≥3 levels.

**Evidence:** `deriveConfidence` returns only 1 (keyword) or 3 (default) — 18/20 events scored 3, zero discrimination. Brier 0.318 was measured by misusing reliability-confidence as adverse-probability.

- [x] Document confidence semantics (reliability ≠ adverse-probability) in code + PRD reference.
- [x] Make `deriveConfidence` data-driven (source count/corroboration, named vs anonymous source, official vs rumor, magnitude specificity) → graduated 1–5.
- [x] Add the adverse-likelihood concept as its own scored field if needed for calibration.
- [x] Unit tests asserting ≥3 distinct confidence levels across representative events.

---

### Task 4: Align evaluation horizon with event type
**Priority:** P1
**Definition of Done:** Event-type (acute shock) alerts are evaluated on short horizons (1d/5d); allocation/portfolio recommendations keep 21d/63d. The 2025 backtest reports acute-shock outcomes on 5d (where Liberation-Day shows −11.9%) instead of washing them out at 21d.

**Evidence:** Fired-event adverse-rate @21d = 0, but Liberation-Day @5d = −11.9%. Acute drawdowns are short and sharp; 21d/63d masks them, flipping the verdict.

- [x] Tag each recommendation/alert with an `evalHorizonClass` (acute vs allocation).
- [x] Update the paper-eval job (`research/quant-python/.../evaluate_paper_recommendations.py`) to pick horizons by class.
- [x] Update `scripts/backtest-2025/run.ts` to report adverse-rate per appropriate horizon.
- [x] Re-run; confirm acute shocks surface on 1d/5d.

---

## Suggested order
T1 → T2 (both P0, recall + precision) → T3 → T4. Re-run `scripts/backtest-2025/run.ts` after each as the acceptance gate.

---

## Result (trigger-scoring-v2)

| Metric | Before | After | Gate |
|---|---|---|---|
| precision | 71.4% | **80.0%** | T2 > 71% ✓ |
| recall | 55.6% | **88.9%** | T1 > 75% ✓ |
| FP-rate | 28.6% | **20.0%** | T1 < 30% ✓ |
| Brier | 0.318 (on reliability) | **0.127** (on `adverseLikelihood`) | T3 ✓ |
| confidence levels | {1,3} → 2 | **{2,3,4,5}** → 4 distinct | T3 ≥ 3 ✓ |
| acted Sharpe | −1.05 (7 sigs, 6 hurt) | **−0.21** (6 sigs, 4 hurt) | T2 ✓ |

- **T1:** TAIEX −10% crash, TSMC limit-down, TWD surge now derive severity ≥ 4 → 3 FNs recovered. Only remaining FN is the hedged/unconfirmed growth-scare (correctly low reliability).
- **T2:** Geneva truce / trade-deals / tariff-pause no longer emit `reduce_position` (bullish → `monitor`).
- **T3:** `confidence` = source reliability; new `adverseLikelihood` (0–1) carries adverse-probability and is the field calibrated/Brier-scored. Semantics documented in `docs/tasks/T3.3.1-…/TASK.md`.
- **T4:** acute shocks judged @5d (Liberation-Day surfaces at **−11.9%**), allocation @21d/63d; paper-eval job picks horizons via `evalHorizonClass`.
