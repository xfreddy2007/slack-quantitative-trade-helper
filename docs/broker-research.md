# Broker API Evaluation — Read-Only Holdings Sync (T9.1.1)

_Milestone 9 research. Scope: read-only holdings/cash/cost-basis sync for Taiwan and U.S.
markets in sandbox/paper mode. **No order placement** is in scope or implemented anywhere._

This document evaluates at least two broker APIs covering TW and US markets, then recommends one
to integrate first. It backs the read-only sync implemented in
`research/quant-python/src/investment_research/broker/`.

---

## Evaluation criteria

| Criterion | Why it matters here |
|---|---|
| Read-only holdings access | We only need positions, quantity, cost basis, and cash — never trading. |
| Market coverage | We hold both TW (e.g. `0050.TW`, `2330.TW`) and US (e.g. `VOO`) positions. |
| Sandbox / paper mode | We must develop and test without touching a live account. |
| Auth mechanism | Determines secret handling and operational complexity. |
| Data freshness | EOD is sufficient for rebalancing; intraday is a bonus. |
| Cost & licensing | Free/low-cost and terms that permit programmatic personal use. |

---

## Option A — Fugle Broker / Trading API (Taiwan)

| Field | Detail |
|---|---|
| Markets | **TW** (TWSE + TPEX listed/OTC). |
| Capabilities | Account holdings (inventory), cash balance, realized/unrealized P&L, average cost per position; market data via the companion Fugle MarketData API. Trading endpoints exist but are **out of scope** — we call only the read/inventory endpoints. |
| Auth | API key + per-account certificate (SDK-managed); OAuth-style token for MarketData. Personal developer keys via the Fugle developer console. |
| Sandbox | Official **paper/sandbox trading** environment — a dedicated sandbox account separate from live, ideal for read-only development with no real-money risk. |
| Data freshness | Holdings/inventory near-real-time during market hours; EOD settles after close. |
| Cost | Free developer tier for account/holdings reads with a brokerage account; market data has rate limits. |
| Licensing | Permits programmatic access to one's own account; redistribution of market data is restricted (not relevant to a private holdings sync). |
| Fit | First-class TW coverage with an official sandbox and Python SDK — the lowest-friction path for our primary (Taiwan) market. |

## Option B — Interactive Brokers (IBKR): TWS API / Client Portal Web API (US + global)

| Field | Detail |
|---|---|
| Markets | **US** + global (incl. TW via IBKR's routing). |
| Capabilities | Positions, portfolio, average cost, unrealized/realized P&L, cash balances by currency. Two surfaces: the **Client Portal Web API** (REST over a local gateway) and the **TWS API** (socket via TWS/IB Gateway). Order endpoints exist but are **out of scope**. |
| Auth | Session-based via a locally running gateway (Client Portal Gateway or IB Gateway/TWS) authenticated with the account login + 2FA; no long-lived cloud token. |
| Sandbox | **Paper trading account** (free) mirrors the live API surface — read holdings without real-money exposure. |
| Data freshness | Real-time positions while the gateway session is live; market data may require a subscription. |
| Cost | Free API; account required. Market-data subscriptions cost extra (not needed for holdings reads). |
| Licensing | Programmatic personal-account access permitted; the gateway-session model adds operational overhead (a process must stay authenticated). |
| Fit | Best for US/global coverage and depth, but the always-on authenticated gateway is heavier to operate and harder to run headless in CI/sandbox than a key-based REST API. |

## Also surveyed (not selected for first integration)

- **Firstrade** — popular with TW retail for US trading, but no official, documented public holdings API; would require fragile scraping. Rejected.
- **Tiger Brokers (TigerTrade Open API)** — covers US + HK + TW-adjacent; OAuth + RSA-signed requests, paper environment available. Strong alternative to IBKR for US; heavier auth setup. Hold as a second-phase US option.

---

## Recommendation

**Integrate Fugle (Taiwan) first.** Rationale:

1. **Primary market alignment** — Taiwan is the portfolio's home market; cost-basis-driven,
   tax-sensitive rebalancing matters most for TW lots.
2. **Official sandbox + SDK** — a dedicated paper environment and Python SDK give a clean,
   headless, key-based read path; no always-on authenticated gateway to babysit.
3. **Lower operational overhead** than IBKR's gateway-session model for a first read-only slice.

**Phase 2:** add **IBKR** (or **Tiger**) for US holdings once the read-only abstraction is proven,
reusing the same `ReadOnlyBrokerClient` interface.

### Integration approach (this task)

The MVP slice is deliberately offline and provider-agnostic:

- `ReadOnlyBrokerClient` (abc) exposes **only** `fetch_holdings()` and `fetch_cash_balance()` —
  there is no order/trade/withdraw method anywhere in the interface or its implementations.
- `SandboxBrokerClient` reads a recorded sandbox account
  (`packages/fixtures/broker/sandbox-holdings.json`) — deterministic, no network — standing in for
  a Fugle paper account. A real Fugle/IBKR client implements the same interface in Phase 2.
- `sync_holdings()` maps broker rows into the Pydantic `Holding` model; synced `cost_basis`
  activates **tax-sensitive rebalancing** (over-allocated positions with large unrealized gains are
  not flagged `reduce_position`, to avoid forcing a taxable sale — deferred for human review).
- `sync_broker_holdings --dry-run` prints fetched holdings and never writes to the database.

### Safety

Read-only by construction: the client contract has no write surface, and an automated test rejects
any method whose name matches `order|buy|sell|place|submit|cancel|trade|withdraw|transfer` and
asserts that only the read endpoints (`holdings`, `cash_balance`) are exercised during a sync. No
real order-placement path exists in this codebase.
