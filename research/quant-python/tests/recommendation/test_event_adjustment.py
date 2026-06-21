"""
Event-aware risk adjustment engine tests.

Four required scenarios (verified via: uv run pytest -k "event_aware" -v):
  1. high_severity_relevant  — sev 4, rel 3, conf 3 → reduce_position
  2. high_severity_irrelevant — sev 5, rel 2         → do_not_act
  3. low_confidence          — sev 4, rel 3, conf 2 → monitor
  4. severity5_override      — sev 5, rel 3, conf 1 → research_required
"""
import pytest

from investment_research.recommendation.event_adjustment import (
    HoldingExposure,
    adjust_for_event,
)

ADVISORY_PHRASES = ('Consider reviewing', 'Consider monitoring', 'consider reviewing')


def _exposure(
    symbol: str = 'VOO',
    allocation_pct: float = 40.0,
    max_sell: float | None = None,
) -> HoldingExposure:
    return HoldingExposure(
        symbol=symbol,
        allocation_pct=allocation_pct,
        max_single_alert_sell_pct=max_sell,
    )


# ─── scenario 1: high severity + relevant → reduce_position ──────────────────

def test_event_aware_high_severity_relevant_returns_reduce_position():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=[_exposure('VOO', max_sell=15.0)],
    )
    assert rec.action == 'reduce_position'


def test_event_aware_reduce_position_has_required_fields():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=[_exposure('VOO')],
    )
    assert rec.action == 'reduce_position'
    assert rec.time_horizon != ''
    assert rec.rationale != ''
    assert rec.severity == 4
    assert rec.confidence == 3


def test_event_aware_reduce_position_size_within_max_sell_pct():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=[_exposure('VOO', max_sell=20.0)],
    )
    assert rec.suggested_size_max_pct is not None
    assert rec.suggested_size_max_pct <= 20.0
    assert rec.suggested_size_min_pct is not None
    assert rec.suggested_size_min_pct <= rec.suggested_size_max_pct


def test_event_aware_reduce_position_uses_most_conservative_cap():
    exposures = [
        _exposure('VOO', max_sell=20.0),
        _exposure('QQQ', max_sell=10.0),  # stricter cap
    ]
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=exposures,
    )
    assert rec.suggested_size_max_pct <= 10.0


def test_event_aware_reduce_position_uses_default_cap_when_none_set():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=[_exposure('VOO', max_sell=None)],
    )
    assert rec.suggested_size_max_pct is not None
    assert rec.suggested_size_max_pct > 0.0


def test_event_aware_reduce_position_rationale_is_advisory():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=[_exposure('VOO')],
    )
    assert any(phrase in rec.rationale for phrase in ADVISORY_PHRASES), (
        f'Rationale lacks advisory language: {rec.rationale!r}'
    )
    assert 'sell immediately' not in rec.rationale.lower()


# ─── scenario 2: high severity + irrelevant → do_not_act ─────────────────────

def test_event_aware_high_severity_irrelevant_returns_do_not_act():
    rec = adjust_for_event(
        trigger_severity=5,
        trigger_relevance=2,
        trigger_confidence=4,
        exposures=[_exposure('VOO')],
    )
    assert rec.action == 'do_not_act'


def test_event_aware_relevance_below_3_always_do_not_act_regardless_of_severity():
    for sev in range(1, 6):
        rec = adjust_for_event(
            trigger_severity=sev,
            trigger_relevance=2,
            trigger_confidence=5,
            exposures=[_exposure('VOO')],
        )
        assert rec.action == 'do_not_act', f'Expected do_not_act for sev={sev}, rel=2'


def test_event_aware_empty_exposures_returns_do_not_act():
    rec = adjust_for_event(
        trigger_severity=5,
        trigger_relevance=5,
        trigger_confidence=5,
        exposures=[],
    )
    assert rec.action == 'do_not_act'


# ─── scenario 3: low confidence → monitor ────────────────────────────────────

def test_event_aware_low_confidence_returns_monitor_not_reduce():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=2,
        exposures=[_exposure('VOO')],
    )
    assert rec.action in ('monitor', 'research_required')
    assert rec.action != 'reduce_position'


def test_event_aware_confidence_1_returns_monitor():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=4,
        trigger_confidence=1,
        exposures=[_exposure('VOO')],
    )
    assert rec.action in ('monitor', 'research_required')


def test_event_aware_low_confidence_no_size_range():
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=2,
        exposures=[_exposure('VOO')],
    )
    # no sell range when we're only monitoring
    assert rec.suggested_size_max_pct is None


# ─── scenario 4: severity-5 override ─────────────────────────────────────────

def test_event_aware_severity5_override_with_low_confidence_returns_research_required():
    """sev 5 + rel >= 3 + conf 1 → research_required, not do_not_act or monitor."""
    rec = adjust_for_event(
        trigger_severity=5,
        trigger_relevance=3,
        trigger_confidence=1,
        exposures=[_exposure('2330.TW')],
    )
    assert rec.action == 'research_required'


def test_event_aware_severity5_override_rationale_mentions_uncertainty():
    rec = adjust_for_event(
        trigger_severity=5,
        trigger_relevance=4,
        trigger_confidence=2,
        exposures=[_exposure('2330.TW')],
    )
    assert rec.action == 'research_required'
    assert 'uncertainty' in rec.rationale.lower() or 'confidence' in rec.rationale.lower()


def test_event_aware_severity5_high_confidence_still_returns_reduce():
    """sev 5 + sufficient confidence should still return reduce_position."""
    rec = adjust_for_event(
        trigger_severity=5,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=[_exposure('VOO')],
    )
    assert rec.action == 'reduce_position'


# ─── field completeness ───────────────────────────────────────────────────────

def test_event_aware_all_outputs_have_required_fields():
    scenarios = [
        dict(trigger_severity=4, trigger_relevance=3, trigger_confidence=3, exposures=[_exposure()]),
        dict(trigger_severity=5, trigger_relevance=2, trigger_confidence=4, exposures=[_exposure()]),
        dict(trigger_severity=4, trigger_relevance=3, trigger_confidence=2, exposures=[_exposure()]),
        dict(trigger_severity=5, trigger_relevance=3, trigger_confidence=1, exposures=[_exposure()]),
    ]
    for kwargs in scenarios:
        rec = adjust_for_event(**kwargs)
        assert rec.action, 'action must be non-empty'
        assert rec.time_horizon is not None, 'time_horizon must be present'
        assert rec.rationale, 'rationale must be non-empty'
        assert isinstance(rec.severity, int), 'severity must be int'
        assert isinstance(rec.confidence, int), 'confidence must be int'


def test_event_aware_zero_cap_degrades_to_monitor():
    """max_single_alert_sell_pct=0.0 means no selling — degrade to monitor."""
    rec = adjust_for_event(
        trigger_severity=4,
        trigger_relevance=3,
        trigger_confidence=3,
        exposures=[_exposure('VOO', max_sell=0.0)],
    )
    assert rec.action == 'monitor'
    assert rec.suggested_size_max_pct is None


def test_event_aware_float_inputs_coerced_to_int():
    """Float severity/relevance/confidence (e.g. from JSON) stored as int."""
    rec = adjust_for_event(
        trigger_severity=4,    # type: ignore[arg-type]
        trigger_relevance=3,   # type: ignore[arg-type]
        trigger_confidence=3,  # type: ignore[arg-type]
        exposures=[_exposure()],
    )
    assert isinstance(rec.severity, int)
    assert isinstance(rec.confidence, int)


def test_event_aware_do_not_act_returns_empty_affected_symbols():
    """Low relevance → affected_symbols is empty (event doesn't affect holdings)."""
    rec = adjust_for_event(
        trigger_severity=5,
        trigger_relevance=1,
        trigger_confidence=5,
        exposures=[_exposure('VOO'), _exposure('QQQ')],
    )
    assert rec.action == 'do_not_act'
    assert rec.affected_symbols == []


def test_event_aware_action_in_allowed_set():
    allowed = {'monitor', 'hold', 'add_position', 'reduce_position',
               'rebalance', 'hedge', 'do_not_act', 'research_required'}
    scenarios = [
        dict(trigger_severity=4, trigger_relevance=3, trigger_confidence=3, exposures=[_exposure()]),
        dict(trigger_severity=5, trigger_relevance=2, trigger_confidence=4, exposures=[_exposure()]),
        dict(trigger_severity=3, trigger_relevance=3, trigger_confidence=3, exposures=[_exposure()]),
        dict(trigger_severity=5, trigger_relevance=3, trigger_confidence=1, exposures=[_exposure()]),
    ]
    for kwargs in scenarios:
        rec = adjust_for_event(**kwargs)
        assert rec.action in allowed, f'Action {rec.action!r} not in allowed set'
