"""
Routine rebalancing recommendation engine tests.

Four required scenarios (verified via: uv run pytest -k "rebalance" -v):
  1. within threshold  → do_not_act
  2. single-bucket drift → one recommendation
  3. cash floor suppression → add_position suppressed in favour of rebalance
  4. multi-bucket drift → multiple recommendations
"""
from decimal import Decimal

import pytest

from investment_research.portfolio.allocation import AllocationResult
from investment_research.recommendation.rebalance import (
    HUMAN_REVIEW_PHRASE,
    recommend_rebalance,
)


# ─── helpers ──────────────────────────────────────────────────────────────────

def _result(
    bucket: str,
    alloc: float,
    target: float,
    threshold: float = 5.0,
) -> AllocationResult:
    drift = alloc - target
    return AllocationResult(
        bucket=bucket,
        target_pct=target,
        drift_threshold_pct=threshold,
        allocation_pct=alloc,
        drift_pct=drift,
        is_drifted=abs(drift) >= threshold,
        market_value_base=Decimal('10000'),
    )


# ─── scenario 1: within threshold → do_not_act ────────────────────────────────

def test_rebalance_within_threshold_returns_do_not_act():
    results = [
        _result('us_core', alloc=40.0, target=40.0),   # drift = 0
        _result('tw_core', alloc=41.0, target=40.0),   # drift = 1 < 5
        _result('cash',    alloc=19.0, target=20.0),   # drift = -1 < 5
    ]
    recs = recommend_rebalance(results, cash_pct=19.0)
    assert len(recs) == 1
    assert recs[0].action == 'do_not_act'
    assert recs[0].suggested_size_min_pct == 0.0
    assert recs[0].suggested_size_max_pct == 0.0


def test_rebalance_do_not_act_rationale_has_no_human_review_phrase():
    results = [_result('us', alloc=40.0, target=40.0)]
    recs = recommend_rebalance(results, cash_pct=20.0)
    assert HUMAN_REVIEW_PHRASE not in recs[0].rationale


# ─── scenario 2: single-bucket drift ─────────────────────────────────────────

def test_rebalance_single_bucket_over_allocated_returns_reduce_position():
    results = [
        _result('us_core', alloc=47.0, target=40.0),  # drift = +7 > 5
        _result('tw_core', alloc=38.0, target=40.0),  # drift = -2 within
        _result('cash',    alloc=16.0, target=20.0),  # drift = -4 within (< threshold)
    ]
    recs = recommend_rebalance(results, cash_pct=15.0, minimum_cash_pct=5.0)
    assert len(recs) == 1
    assert recs[0].action == 'reduce_position'
    assert recs[0].bucket == 'us_core'
    assert recs[0].suggested_size_max_pct == pytest.approx(7.0)
    assert recs[0].suggested_size_min_pct == pytest.approx(3.5)
    assert HUMAN_REVIEW_PHRASE in recs[0].rationale


def test_rebalance_single_bucket_under_allocated_with_cash_returns_add_position():
    results = [
        _result('us_core', alloc=33.0, target=40.0),  # drift = -7 > 5
        _result('cash',    alloc=24.0, target=20.0),  # drift = +4 within (< threshold)
    ]
    recs = recommend_rebalance(results, cash_pct=27.0, minimum_cash_pct=10.0)
    assert len(recs) == 1
    assert recs[0].action == 'add_position'
    assert recs[0].bucket == 'us_core'
    assert HUMAN_REVIEW_PHRASE in recs[0].rationale


def test_rebalance_size_range_is_half_to_full_drift_magnitude():
    results = [_result('us', alloc=50.0, target=40.0)]  # drift = +10
    recs = recommend_rebalance(results, cash_pct=20.0)
    assert recs[0].suggested_size_min_pct == pytest.approx(5.0)
    assert recs[0].suggested_size_max_pct == pytest.approx(10.0)


# ─── scenario 3: cash floor suppression ──────────────────────────────────────

def test_rebalance_cash_floor_suppresses_add_position():
    """Under-allocated bucket + cash below floor → rebalance, NOT add_position."""
    results = [
        _result('us_core', alloc=33.0, target=40.0),  # drift = -7, would normally add
        _result('tw_core', alloc=47.0, target=40.0),  # drift = +7, over-allocated
        _result('cash',    alloc=20.0, target=20.0),  # within
    ]
    # cash_pct = 3% < minimum 5%
    recs = recommend_rebalance(results, cash_pct=3.0, minimum_cash_pct=5.0)

    actions = {r.bucket: r.action for r in recs}
    assert 'add_position' not in actions.values(), 'add_position must be suppressed when cash < floor'
    assert actions['us_core'] == 'rebalance'
    assert actions['tw_core'] == 'reduce_position'


def test_rebalance_cash_floor_rationale_mentions_cash_constraint():
    results = [_result('us_core', alloc=33.0, target=40.0)]
    recs = recommend_rebalance(results, cash_pct=2.0, minimum_cash_pct=5.0)
    assert recs[0].action == 'rebalance'
    assert HUMAN_REVIEW_PHRASE in recs[0].rationale
    assert '2.0%' in recs[0].rationale  # cash_pct referenced


def test_rebalance_add_position_allowed_when_cash_exactly_at_floor():
    """cash_pct == minimum_cash_pct → floor NOT active (strictly less than)."""
    results = [_result('us_core', alloc=33.0, target=40.0)]
    recs = recommend_rebalance(results, cash_pct=5.0, minimum_cash_pct=5.0)
    assert recs[0].action == 'add_position'


# ─── scenario 4: multi-bucket drift ──────────────────────────────────────────

def test_rebalance_multi_bucket_drift_returns_one_rec_per_drifted_bucket():
    results = [
        _result('us_core',  alloc=50.0, target=40.0),  # +10, over → reduce
        _result('tw_core',  alloc=30.0, target=40.0),  # -10, under → add (cash ok)
        _result('bonds',    alloc=20.0, target=20.0),  # 0, within
    ]
    recs = recommend_rebalance(results, cash_pct=20.0, minimum_cash_pct=5.0)
    assert len(recs) == 2
    buckets = {r.bucket for r in recs}
    assert 'us_core' in buckets
    assert 'tw_core' in buckets
    assert 'bonds' not in buckets


def test_rebalance_multi_bucket_all_non_do_not_act_include_human_review():
    results = [
        _result('a', alloc=50.0, target=40.0),  # +10
        _result('b', alloc=30.0, target=40.0),  # -10
    ]
    recs = recommend_rebalance(results, cash_pct=20.0)
    for rec in recs:
        assert HUMAN_REVIEW_PHRASE in rec.rationale, f'{rec.bucket} missing human review phrase'


# ─── confidence bounds ────────────────────────────────────────────────────────

def test_rebalance_confidence_bounded_zero_to_one():
    results = [_result('us', alloc=99.0, target=40.0)]  # extreme drift
    recs = recommend_rebalance(results, cash_pct=1.0)
    assert 0.0 <= recs[0].confidence <= 1.0
