from dataclasses import dataclass, field
from typing import Optional

# Default sell cap when holding.max_single_alert_sell_pct is not configured.
_DEFAULT_MAX_SELL_PCT = 10.0

# PRD Section 10.4 thresholds
_MIN_RELEVANCE = 3        # below this → do_not_act regardless of severity
_CONFIDENCE_THRESHOLD = 3  # confidence must be >= this to allow reduce_position
_MIN_SEVERITY_REDUCE = 4   # severity must reach this to allow reduce_position


@dataclass
class HoldingExposure:
    """Portfolio exposure for a single symbol affected by a trigger event."""

    symbol: str
    allocation_pct: float
    max_single_alert_sell_pct: Optional[float] = None


@dataclass
class EventRecommendation:
    """Advisory recommendation produced by event-aware risk adjustment.

    Kept separate from routine rebalancing recommendations (T2.2.1).
    All rationale strings use advisory language — no strong imperatives.
    """

    action: str
    time_horizon: str
    rationale: str
    severity: int
    confidence: int
    affected_symbols: list[str] = field(default_factory=list)
    suggested_size_min_pct: Optional[float] = None
    suggested_size_max_pct: Optional[float] = None


def adjust_for_event(
    trigger_severity: int,
    trigger_relevance: int,
    trigger_confidence: int,
    exposures: list[HoldingExposure],
    time_horizon: str = 'short_term',
) -> EventRecommendation:
    """Produce an advisory recommendation for a single trigger event.

    Decision rules (PRD Section 10.4, applied in priority order):
      1. relevance < 3 OR no exposures → do_not_act
      2. severity == 5 AND confidence < 3 AND relevance >= 3 → research_required
         (severity-5 override: flag even when signal is weak)
      3. confidence < 3 (non-sev-5) → monitor
      4. severity >= 4 AND confidence >= 3 → reduce_position
         (size capped by holdings' max_single_alert_sell_pct; 0-cap degrades to monitor)
      5. severity < 4 but relevant → monitor

    Args:
        trigger_severity: 1–5. How serious the external event is.
        trigger_relevance: 1–5. How relevant the event is to this portfolio.
        trigger_confidence: 1–5. Signal-to-noise confidence in the trigger.
        exposures: Holdings affected by this event. Empty list → do_not_act.
        time_horizon: Advisory horizon label passed through to the output.

    Returns:
        EventRecommendation with advisory (non-imperative) rationale.
    """
    # Coerce to int — guards against callers passing floats from JSON deserialisation.
    trigger_severity = int(trigger_severity)
    trigger_relevance = int(trigger_relevance)
    trigger_confidence = int(trigger_confidence)

    affected_symbols = [e.symbol for e in exposures]

    # Rule 1 — low relevance or no affected holdings
    if trigger_relevance < _MIN_RELEVANCE or not exposures:
        return EventRecommendation(
            action='do_not_act',
            time_horizon='n/a',
            rationale=(
                'Event relevance is below portfolio threshold — '
                'no material impact on current holdings expected.'
            ),
            severity=trigger_severity,
            confidence=trigger_confidence,
            affected_symbols=[],  # event is irrelevant; no holdings are considered affected
        )

    # Rule 2 — severity-5 override: flag even with low confidence
    if trigger_severity == 5 and trigger_confidence < _CONFIDENCE_THRESHOLD:
        return EventRecommendation(
            action='research_required',
            time_horizon=time_horizon,
            rationale=(
                f'Severity-5 event detected affecting {", ".join(affected_symbols)}. '
                f'Signal confidence is low ({trigger_confidence}/5) — consider reviewing '
                f'portfolio exposure and gathering more information before acting. '
                f'High uncertainty; no position change recommended without further research.'
            ),
            severity=trigger_severity,
            confidence=trigger_confidence,
            affected_symbols=affected_symbols,
        )

    # Rule 3 — low confidence (non-sev-5): monitor, do not reduce
    if trigger_confidence < _CONFIDENCE_THRESHOLD:
        return EventRecommendation(
            action='monitor',
            time_horizon=time_horizon,
            rationale=(
                f'Consider monitoring {", ".join(affected_symbols)} — '
                f'signal confidence ({trigger_confidence}/5) is below the threshold '
                f'required to act. Reassess if confidence improves.'
            ),
            severity=trigger_severity,
            confidence=trigger_confidence,
            affected_symbols=affected_symbols,
        )

    # Rule 4 — high severity + sufficient confidence
    # Invariant: trigger_relevance >= _MIN_RELEVANCE is guaranteed by Rule 1.
    if trigger_severity >= _MIN_SEVERITY_REDUCE:
        caps = [
            e.max_single_alert_sell_pct
            for e in exposures
            if e.max_single_alert_sell_pct is not None
        ]
        max_sell = min(caps) if caps else _DEFAULT_MAX_SELL_PCT

        # A cap of 0 means "no selling permitted on alerts" — degrade to monitor.
        if max_sell <= 0:
            return EventRecommendation(
                action='monitor',
                time_horizon=time_horizon,
                rationale=(
                    f'Consider monitoring {", ".join(affected_symbols)} — '
                    f'position sell cap is zero; no reduction permitted by holding rules.'
                ),
                severity=trigger_severity,
                confidence=trigger_confidence,
                affected_symbols=affected_symbols,
            )

        min_sell = round(max_sell * 0.5, 2)

        return EventRecommendation(
            action='reduce_position',
            time_horizon=time_horizon,
            rationale=(
                f'Consider reviewing whether to reduce exposure to '
                f'{", ".join(affected_symbols)} given a severity-{trigger_severity} '
                f'event (relevance {trigger_relevance}/5, confidence {trigger_confidence}/5). '
                f'Advisory only — review your investment strategy before making any changes.'
            ),
            severity=trigger_severity,
            confidence=trigger_confidence,
            affected_symbols=affected_symbols,
            suggested_size_min_pct=min_sell,
            suggested_size_max_pct=max_sell,
        )

    # Rule 5 — lower severity but relevant event
    return EventRecommendation(
        action='monitor',
        time_horizon=time_horizon,
        rationale=(
            f'Consider monitoring {", ".join(affected_symbols)} — '
            f'severity {trigger_severity}/5 is below the threshold for a position change. '
            f'No action recommended at this time.'
        ),
        severity=trigger_severity,
        confidence=trigger_confidence,
        affected_symbols=affected_symbols,
    )
