"""Tax-sensitive rebalance activation (AC#3).

An over-allocated bucket holding a large unrealized gain (with cost_basis) is
deferred to 'monitor' instead of 'reduce_position'. Without cost_basis the same
drift still yields 'reduce_position'.

Filter: uv run pytest research/quant-python -k "broker" -v
"""
from datetime import datetime, timezone
from decimal import Decimal

from investment_research.portfolio import (
    AllocationTarget,
    Holding,
    Portfolio,
    PriceSnapshot,
    calculate_allocation,
)
from investment_research.portfolio.models import CostBasis
from investment_research.recommendation.rebalance import recommend_rebalance


def _snapshot(symbol: str, price: str) -> PriceSnapshot:
    return PriceSnapshot(
        symbol=symbol,
        market='US',
        price=Decimal(price),
        currency='USD',
        timestamp=datetime(2026, 6, 20, tzinfo=timezone.utc),
        provider='test',
    )


def _targets() -> list[AllocationTarget]:
    # us_equity target 50% but will hold ~80% -> drifts well beyond 5%.
    return [
        AllocationTarget(bucket='us_equity', target_pct=50, drift_threshold_pct=5, markets=['US'], asset_types=['ETF']),
        AllocationTarget(bucket='us_bond', target_pct=50, drift_threshold_pct=5, markets=['US'], asset_types=['ETF']),
    ]


PRICES = {
    'VOO': _snapshot('VOO', '545.80'),  # current
    'BND': _snapshot('BND', '72.00'),
}


def test_high_gain_over_allocated_bucket_is_deferred_to_monitor():
    # VOO: 30 @ 545.80 = 16374 ; cost 30 @ 420.50 = 12615 -> gain ~29.8% (>= 20)
    portfolio = Portfolio(
        name='tax-defer',
        allocation_targets=_targets(),
        holdings=[
            Holding(
                symbol='VOO', market='US', asset_type='ETF',
                quantity=Decimal('30'), currency='USD', target_bucket='us_equity',
                cost_basis=CostBasis(avg_cost=Decimal('420.50'), currency='USD', lot_method='weighted_avg'),
            ),
            Holding(
                symbol='BND', market='US', asset_type='ETF',
                quantity=Decimal('55'), currency='USD', target_bucket='us_bond',
            ),
        ],
    )
    results = calculate_allocation(portfolio, PRICES)
    us_equity = next(r for r in results if r.bucket == 'us_equity')
    assert us_equity.is_drifted and us_equity.drift_pct > 0
    assert us_equity.unrealized_gain_pct is not None
    assert us_equity.unrealized_gain_pct >= 20.0

    recs = recommend_rebalance(results, cash_pct=10.0)
    equity_rec = next(r for r in recs if r.bucket == 'us_equity')
    assert equity_rec.action == 'monitor'
    assert equity_rec.action != 'reduce_position'
    lowered = equity_rec.rationale.lower()
    assert 'tax' in lowered or 'gain' in lowered


def test_same_drift_without_cost_basis_still_reduces():
    portfolio = Portfolio(
        name='no-cost-basis',
        allocation_targets=_targets(),
        holdings=[
            Holding(
                symbol='VOO', market='US', asset_type='ETF',
                quantity=Decimal('30'), currency='USD', target_bucket='us_equity',
            ),
            Holding(
                symbol='BND', market='US', asset_type='ETF',
                quantity=Decimal('55'), currency='USD', target_bucket='us_bond',
            ),
        ],
    )
    results = calculate_allocation(portfolio, PRICES)
    us_equity = next(r for r in results if r.bucket == 'us_equity')
    assert us_equity.is_drifted and us_equity.drift_pct > 0
    assert us_equity.tax_sensitive is False

    recs = recommend_rebalance(results, cash_pct=10.0)
    equity_rec = next(r for r in recs if r.bucket == 'us_equity')
    assert equity_rec.action == 'reduce_position'
