# §03 — Functional E2E

> **Stub for discussion.** Wraps the existing functional suite, maps it to PRD requirements, and names gaps.
> Does **not** duplicate `.claude/e2e-tests.md`. Parent: [README](./README.md).

## Source of truth

`.claude/e2e-tests.md` — 13 groups (0, 0A, 0B, 1–12), ~103 phase-gated cases, run via the **`/e2e`** skill.
Infra: Docker Compose Postgres (S1–S4), phase detection gates DB-dependent tests.

| Group | Area |
|-------|------|
| 0 / 0A / 0B | infra health · shared schemas + seed · TS app shell |
| 1 | fixture asset loading |
| 2 / 3 / 4 | allocation · drift & rebalancing · event-aware risk adjustment |
| 5 | paper-rec writer + daily job |
| 6 | source ingestion + wiki |
| 7 | trigger scoring + alert budget |
| 8 | full e2e fixture pipeline |
| 9 / 10 | Slack commands (mock) · connection validation |
| 11 | provider failure isolation |
| 12 | paper-rec evaluation |

## Coverage map → PRD FR1–FR10 (`PRD.md` §11)

| FR | Requirement | e2e group(s) |
|----|-------------|--------------|
| FR1 | News Collection | 6 |
| FR2 | Source Ingestion | 6 |
| FR3 | Market Impact Analysis | 4, 7 |
| FR4 | Portfolio Mapping | 2 |
| FR5 | Trigger Evaluation | 7 |
| FR6 | Slack Notification | 8, 9, 10 |
| FR7 | Feedback Loop | 9 (feedback/mute) |
| FR8 | Audit Trail | 5, 6 (log/persist) |
| FR9 | Rebalancing Recommendations | 3 |
| FR10 | Paper Recommendation Log | 5, 12 |

> Map is provisional — confirm each cell against the actual test assertions during discussion.

## Role in the suite

Functional e2e is the backbone of the **Full** tier. This section's job is to keep the FR→group map current,
flag coverage gaps, and define how `/e2e` is invoked from the orchestrator ([§02](./02-validation-tiers.md)).

## Open questions for discussion

- Coverage gaps: any FR with thin/no assertions? (candidate: FR7 feedback aggregation depth, FR8 audit completeness)
- Run `/e2e` as-is vs wrap in the orchestrator for a unified pass/fail table?
- Phase gates vs "everything is implemented now" — retire gates or keep for partial-checkout safety?

## Links

- `.claude/e2e-tests.md` · `PRD.md` (§11 Functional Requirements) · `e2e-test` skill
