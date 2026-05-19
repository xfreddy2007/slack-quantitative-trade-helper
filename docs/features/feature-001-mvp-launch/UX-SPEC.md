# UX Spec — MVP Launch

## Primary Surface

The MVP user experience is Slack-first. User-facing output defaults to Traditional Chinese using Taiwan terminology. Internal schemas and engineering docs may remain English.

## Scheduled Flows

### Taiwan Pre-Market Brief

- Trigger: Taiwan trading day at 08:30 Taipei time.
- Market reference: 30 minutes before Taiwan regular market open at 09:00 Taipei time.
- Output sections:
  - `今日觀察`
  - `可考慮調整`
  - `不建議動作`
  - paper-only disclaimer

### U.S. Pre-Market Brief

- Trigger: 30 minutes before U.S. regular market open.
- Taipei delivery time:
  - 21:00 during U.S. daylight saving time.
  - 22:00 during U.S. standard time.
- Output sections match the Taiwan brief.

## Slack Commands

MVP commands follow the full command list in the root `PRD.md`:

```text
/investment status
/investment portfolio
/investment brief today
/investment brief tw
/investment brief us
/investment recommendation today
/investment paper-log
/investment explain <alert_id>
/investment mute <ticker|topic>
/investment feedback <alert_id> useful|not_useful|too_noisy|too_late
```

## Key States

- Normal daily brief with observations, possible adjustments, and explicit no-action rationale.
- Material alert with affected holdings, severity, confidence, time horizon, rationale, citations, and alert ID.
- Empty/no-action state where no recommendation is warranted.
- Low-confidence state where the action is monitor or research required.
- Duplicate/suppressed alert state logged for auditability, not posted unless severity increases or new material facts appear.
- Command not-found state for unknown recommendation or alert IDs.
- Slack/API failure state with retry behavior and persisted failure status.

## UX Requirements

- Every recommendation must be advisory and paper-only.
- Every material alert must include uncertainty and source references.
- Routine rebalancing and event-driven risk adjustment must be explained separately when both apply.
- Commands should acknowledge quickly and perform heavier work asynchronously.
- Event-driven alert budget is max 3 Taiwan alerts and max 3 U.S. alerts per day, excluding severity-5 overrides.
