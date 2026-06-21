# Real-Time Market-Data Provider Research

> **Date:** 2026-06-21 · **Status:** research / recommendation (no code yet)
> **Question:** current real-time provider **Fugle** has limited history horizon + intraday interval
> granularity. What replaces/augments it for **TW + US**?

## Requirements (locked)

| Dimension | Decision |
|-----------|----------|
| Markets | **Both TW + US** |
| Latency | **Near-real-time snapshots** OK (1–15 min delayed REST acceptable; true streaming not required) |
| Granularity | **1-minute bars** |
| Budget | **Free first**, flexible to **low (<$25/mo)** if free isn't fresh/accurate enough |

## Google Finance — not viable, skip

No public API since **Oct 2012** (deprecated 2011). Only survivor is the `GOOGLEFINANCE()` Google Sheets
function:

- 15–20 min delayed, **no real-time**
- **No programmatic API** — Sheets-only, needs Google auth, rate-limited
- No options/Greeks, no tick/intraday streaming
- Scraping is brittle + ToS risk

**Verdict:** cannot serve as a programmatic provider. Dropped.
[Source](https://www.ipfly.net/blog/google-finance-api-alternatives-2026/)

## Fugle (current) — why it falls short

Broker API, **TW-only**. REST + WebSocket real-time intraday quotes. Pain matches the ask: historical candle
**horizon is shallow** and **interval granularity is limited** on the standard tier.
[Docs](https://developer.fugle.tw/docs/data/http-api/intraday/quote/)

---

## Taiwan providers

| Provider | Type | Real-time | Intraday | History | Streaming | Cost |
|----------|------|-----------|----------|---------|-----------|------|
| **Fugle** (current) | Broker API | Yes | tick + candles, limited | shallow | WebSocket | Free w/ account |
| **Shioaji** (SinoPac) | Broker API (Python) | Yes (tick/bidask) | tick, 1m+ kbars | deeper kbars | SSE/stream | Free w/ account |
| **Fubon Neo** | Broker API | Yes | intraday + snapshot | historical incl. | WebSocket | Free w/ account |
| **FinMind** (in-project) | Open data | **No** (EOD/daily) | daily | multi-year deep | No | Free + paid |
| **TWSE/TPEX** (in-project) | Official | Delayed/EOD | daily | EOD | No | Free |
| **Twelve Data** | Vendor | Yes (paid) | 1m–1d, global incl TW | deep | WebSocket | Free 800/day (delayed) → paid |

Sources: [Shioaji](https://sinotrade.github.io/) · [Fubon Neo](https://www.fbs.com.tw/TradeAPI/en/docs/market-data/intro/) · [FinMind](https://github.com/FinMind/FinMind)

## US providers

| Provider | Real-time | Intraday | History | Streaming | Free tier | Paid |
|----------|-----------|----------|---------|-----------|-----------|------|
| **Alpha Vantage** (in-project) | paid only | 1m–monthly, 50+ indicators | 20+ yr | No | **25 calls/day** (tiny) | ~$50/mo |
| **Finnhub** | Yes (US) | 1m+, news+sentiment | deep | WebSocket | **60 calls/min** (best free) | from ~$50/mo |
| **Twelve Data** | paid | 1m–1d, global incl TW | deep | WebSocket | 800/day (≈4h delayed) | → $329/mo |
| **Polygon.io** | Yes | tick/1m, deep | 15+ yr | strong WebSocket | **none** | from $99/mo |
| **FMP** | Yes | intraday | deep | REST + WS | limited | **$19/mo flat unlimited** |
| **yfinance** | delayed | 1m–1d | deep | No | free (unofficial) | — blacklist/breakage risk |

Sources: [7 best real-time APIs 2026](https://medium.com/coinmonks/the-7-best-real-time-stock-data-apis-for-investors-and-developers-in-2026-in-depth-analysis-61614dc9bf6c) · [free-tier comparison](https://qveris.ai/guides/stock-api-free-comparison/)

---

## Recommendation

### Primary: **Twelve Data** — one adapter, both markets

- Single vendor covering **TW + US** (+ global), **1-minute intraday**, REST snapshots → matches
  "near-real-time + 1-min" exactly.
- Free tier **800 calls/day** (delayed quotes — fine given near-real-time accepted).
- Clean upgrade path to a low paid tier if free quota/freshness falls short. **Verify exact low-tier price at
  signup** — ~$29 Basic is borderline over the <$25 ceiling; confirm before committing.

### US augment: **Finnhub (free)** — fixes Alpha Vantage's quota pain

- **60 calls/min** free vs AV's **25/day**; US 1-min candles + news/sentiment; WebSocket available later.
- Replaces AV as US real-time source. Keep AV only if its 50+ precomputed indicators are wanted.

### Keep as-is

- **FinMind + TWSE/TPEX** for deep TW **EOD history** (backtest horizon) — they are not the real-time layer.
- **Shioaji / Fubon Neo** are the fallback if TW needs *fresher-than-delayed* real-time (broker account +
  heavier integration).

| Need | Pick | Tier |
|------|------|------|
| TW + US 1-min snapshots | **Twelve Data** | Free → low |
| US real-time, high quota | **Finnhub** | Free |
| TW deep EOD history | FinMind / TWSE | Free (wired) |
| Fresher TW real-time (if needed) | Shioaji / Fubon Neo | Free w/ account |

## Quota reality check

800 calls/day (Twelve Data free) is fine for an ETF-first small portfolio polling a handful of symbols at
1-min during market windows. Polling many symbols every minute all session blows the cap → that is the
trigger to move to the low paid tier.

## Integration path (fits existing code)

- New adapters `apps/slack-bot/src/providers/twelve-data.ts` + `providers/finnhub.ts`, same contract as
  `providers/alpha-vantage.ts` / `providers/finmind.ts`.
- Wrap in the existing `runIsolated` failure-isolation boundary + provider-chain switching
  (T6.2.1 / T7.2.1) — a provider outage records a `provider_runs` status, never breaks commands.
- Add a rate-limit guard like AV's (daily / per-min cap) → records `rate_limit` in `provider_runs`.
- Extend **e2e Group 11** (provider failure isolation) with the two new adapters.

## Open questions

- Confirm Twelve Data low-tier price/quota at signup (<$25 ceiling).
- Twelve Data TW real-time on free = delayed only — acceptable, or do we want Shioaji/Fubon for fresher TW?
- Retire Alpha Vantage entirely, or keep for its technical indicators?

## Sources

- [Google Finance API status & alternatives 2026](https://www.ipfly.net/blog/google-finance-api-alternatives-2026/)
- [Fugle developer docs](https://developer.fugle.tw/docs/data/http-api/intraday/quote/)
- [Shioaji (SinoPac)](https://sinotrade.github.io/) · [Fubon Neo API](https://www.fbs.com.tw/TradeAPI/en/docs/market-data/intro/) · [FinMind](https://github.com/FinMind/FinMind)
- [7 best real-time stock APIs 2026](https://medium.com/coinmonks/the-7-best-real-time-stock-data-apis-for-investors-and-developers-in-2026-in-depth-analysis-61614dc9bf6c)
- [Free stock API comparison 2026](https://qveris.ai/guides/stock-api-free-comparison/)
