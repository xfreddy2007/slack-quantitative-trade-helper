# PRD — MVP Launch

## Problem Statement

Investment Helper needs a fixture-first MVP that proves the full recommendation loop before live provider dependency or broker integration: ingest market inputs, maintain an investment wiki, map events to portfolio exposure, generate rebalancing recommendations, record paper recommendations, and render Slack output for private personal use.

## Goals

- Build the TypeScript + Python + PostgreSQL MVP described in the root `PRD.md` and `IMPLEMENTATION_PLAN.md`.
- Use fixture-driven development first so the full loop is reproducible without external APIs.
- Support the full MVP Slack command list from the root `PRD.md`.
- Keep recommendations advisory, paper-only, and human-reviewed.
- Keep generated user-specific knowledge and personal portfolio artifacts ignored by default.

## Non-Goals

- No broker order placement.
- No public/external user launch.
- No paid data-provider dependency before fixture flow works.
- No Go service in MVP.
- No design system establishment unless a future UI surface requires it.

## Launch Decisions

- Initial allocation defaults: U.S. core ETF 40%, Taiwan core ETF 40%, cash/short-term 20%.
- Initial drift threshold: 5%.
- Initial paper evaluation: 5-day return, volatility/drawdown note, allocation discipline.
- Taiwan daily brief: 08:30 Taipei time on Taiwan trading days.
- U.S. daily brief: 30 minutes before U.S. regular market open, which is 21:00 Taipei during U.S. daylight saving time and 22:00 Taipei during U.S. standard time.
- Slack MVP commands follow the full command list in the root `PRD.md`.
- Launch mode: private personal use.

## User Stories

- As a long-term investor, I want daily Taiwan and U.S. pre-market recommendations so I can review actions before markets open.
- As a long-term ETF investor, I want allocation drift checks so I can rebalance systematically.
- As an investor, I want high-signal event alerts tied to my holdings so I can prioritize material information.
- As an investor, I want every suggested action recorded as a paper recommendation so I can evaluate quality before any broker integration.
- As an investor, I want citations, severity, confidence, and rationale so I can verify why the assistant reached a conclusion.

## Acceptance Criteria

- [ ] Fixture-driven E2E flow runs locally without external APIs.
- [ ] PostgreSQL migrations are reproducible.
- [ ] TypeScript Slack renderer produces daily recommendations and material alerts.
- [ ] Python writes paper recommendations and paper evaluations.
- [ ] All MVP Slack commands from root `PRD.md` have handler tests.
- [ ] Generated user-specific knowledge, personal wiki output, logs, and portfolio artifacts are ignored by default.
- [ ] Fly.io + Neon deployment is documented and smoke-tested.
- [ ] Recommendations are clearly advisory, paper-only, and human-reviewed.

## Technical Notes

- Root `DEVELOPMENT_SCHEDULE.md` remains the detailed stable backlog.
- This feature folder is the PM handoff entry point for MVP launch development.
- Engineering should start with Phase 0 and proceed by task dependency order.
