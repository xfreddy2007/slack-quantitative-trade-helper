from decimal import Decimal

import pytest

from investment_research.portfolio.allocation import AllocationResult
from investment_research.portfolio.drift import detect_drift


def _result(bucket: str, alloc: float, target: float, threshold: float) -> AllocationResult:
    drift = alloc - target
    return AllocationResult(
        bucket=bucket,
        target_pct=target,
        drift_threshold_pct=threshold,
        allocation_pct=alloc,
        drift_pct=drift,
        is_drifted=abs(drift) >= threshold,
        market_value_base=Decimal('1000'),
    )


def test_within_threshold_produces_no_action():
    results = [
        _result('us_core_etf', alloc=40.0, target=40.0, threshold=5.0),   # drift = 0
        _result('tw_core_etf', alloc=41.0, target=40.0, threshold=5.0),   # drift = 1 < 5
        _result('cash',        alloc=19.0, target=20.0, threshold=5.0),   # drift = -1 < 5
    ]
    drifted = detect_drift(results)
    assert drifted == []


def test_exceeds_threshold_returns_drifted_bucket():
    results = [
        _result('us_core_etf', alloc=47.0, target=40.0, threshold=5.0),  # drift = +7 > 5
        _result('tw_core_etf', alloc=38.0, target=40.0, threshold=5.0),  # drift = -2 < 5
        _result('cash',        alloc=15.0, target=20.0, threshold=5.0),  # drift = -5 == 5
    ]
    drifted = detect_drift(results)
    buckets = {r.bucket for r in drifted}
    assert 'us_core_etf' in buckets     # +7 exceeds threshold
    assert 'cash' in buckets             # -5 meets threshold (>= 5)
    assert 'tw_core_etf' not in buckets  # -2 within threshold


def test_exact_threshold_boundary_is_drifted():
    r = _result('us', alloc=45.0, target=40.0, threshold=5.0)  # exactly at threshold
    assert r.is_drifted is True
    assert detect_drift([r]) == [r]


def test_just_below_threshold_is_not_drifted():
    r = _result('us', alloc=44.9, target=40.0, threshold=5.0)  # 4.9 < 5
    assert r.is_drifted is False
    assert detect_drift([r]) == []


def test_negative_drift_exceeds_threshold():
    r = _result('tw', alloc=30.0, target=40.0, threshold=5.0)  # drift = -10
    assert r.is_drifted is True
    drifted = detect_drift([r])
    assert len(drifted) == 1
    assert drifted[0].drift_pct == pytest.approx(-10.0)


def test_empty_results_returns_empty():
    assert detect_drift([]) == []


def test_all_drifted_returns_all():
    results = [
        _result('a', alloc=10.0, target=33.0, threshold=5.0),  # -23
        _result('b', alloc=10.0, target=33.0, threshold=5.0),  # -23
        _result('c', alloc=80.0, target=34.0, threshold=5.0),  # +46
    ]
    drifted = detect_drift(results)
    assert len(drifted) == 3
