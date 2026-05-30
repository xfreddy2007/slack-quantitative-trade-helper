"""
Allocation calculator tests.
Uses both controlled synthetic portfolios for exact assertions
and fixture files from packages/fixtures/ for integration coverage.
"""
import json
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import pytest

from investment_research.portfolio import (
    AllocationTarget,
    Holding,
    Portfolio,
    PriceSnapshot,
    calculate_allocation,
)

FIXTURES_ROOT = Path(__file__).parents[4] / 'packages' / 'fixtures'


# ─── helpers ──────────────────────────────────────────────────────────────────

def _ts() -> datetime:
    return datetime(2026, 5, 29, 8, 0, 0, tzinfo=timezone.utc)


def _snapshot(symbol: str, market: str, price: str, currency: str = 'USD') -> PriceSnapshot:
    return PriceSnapshot(
        symbol=symbol,
        market=market,
        price=Decimal(price),
        currency=currency,
        timestamp=_ts(),
        provider='test',
    )


def _load_fixture_portfolio(name: str) -> Portfolio:
    data = json.loads((FIXTURES_ROOT / 'portfolios' / f'{name}.json').read_text())
    return Portfolio(**data)


def _load_fixture_price(filename: str) -> PriceSnapshot:
    data = json.loads((FIXTURES_ROOT / 'prices' / filename).read_text())
    return PriceSnapshot(**data)


# ─── controlled 40/40/20 scenario ─────────────────────────────────────────────

@pytest.fixture
def balanced_portfolio() -> Portfolio:
    """Synthetic portfolio whose current value should land at 40/40/20."""
    return Portfolio(
        name='balanced',
        allocation_targets=[
            AllocationTarget(bucket='us_core_etf', target_pct=40, drift_threshold_pct=5, markets=['US'], asset_types=['ETF']),
            AllocationTarget(bucket='tw_core_etf', target_pct=40, drift_threshold_pct=5, markets=['TW'], asset_types=['ETF']),
            AllocationTarget(bucket='cash', target_pct=20, drift_threshold_pct=5, markets=['US', 'TW'], asset_types=['cash']),
        ],
        holdings=[
            Holding(symbol='VOO',  market='US', asset_type='ETF',  quantity=Decimal('40'), currency='USD', target_bucket='us_core_etf'),
            Holding(symbol='TW50', market='TW', asset_type='ETF',  quantity=Decimal('40'), currency='USD', target_bucket='tw_core_etf'),
            Holding(symbol='CASH', market='US', asset_type='cash', quantity=Decimal('1'),  currency='USD', target_bucket='cash'),
        ],
    )


@pytest.fixture
def balanced_prices() -> dict[str, PriceSnapshot]:
    return {
        'VOO':  _snapshot('VOO',  'US', '100.00'),
        'TW50': _snapshot('TW50', 'TW', '100.00'),
        'CASH': _snapshot('CASH', 'US', '2000.00'),
    }


def test_allocation_sums_to_100(balanced_portfolio, balanced_prices):
    results = calculate_allocation(balanced_portfolio, balanced_prices)
    total = sum(r.allocation_pct for r in results)
    assert abs(total - 100.0) < 0.01


def test_balanced_portfolio_gives_40_40_20(balanced_portfolio, balanced_prices):
    results = calculate_allocation(balanced_portfolio, balanced_prices)
    by_bucket = {r.bucket: r.allocation_pct for r in results}
    assert abs(by_bucket['us_core_etf'] - 40.0) < 0.01
    assert abs(by_bucket['tw_core_etf'] - 40.0) < 0.01
    assert abs(by_bucket['cash'] - 20.0) < 0.01


# ─── fixture-based tests ──────────────────────────────────────────────────────

@pytest.fixture
def fixture_prices_usd() -> dict[str, PriceSnapshot]:
    """Price snapshots from fixture files; TWD holdings normalised via exchange rate."""
    return {
        'VOO':     _load_fixture_price('voo.json'),
        '0050.TW': _load_fixture_price('0050-tw.json'),
        '2330.TW': _load_fixture_price('2330-tw.json'),
        'USD_CASH': _load_fixture_price('cash.json'),
    }


TWD_TO_USD = {'TWD': Decimal('0.031'), 'USD': Decimal('1.0')}


def test_tw_etf_allocation_sums_to_100():
    portfolio = _load_fixture_portfolio('tw-etf')
    prices = {
        '0050.TW': _load_fixture_price('0050-tw.json'),
        '0056.TW': _snapshot('0056.TW', 'TW', '35.50', 'TWD'),
    }
    results = calculate_allocation(portfolio, prices, exchange_rates=TWD_TO_USD)
    total = sum(r.allocation_pct for r in results)
    assert abs(total - 100.0) < 0.01


def test_us_etf_allocation_sums_to_100():
    portfolio = _load_fixture_portfolio('us-etf')
    prices = {
        'VOO': _load_fixture_price('voo.json'),
        'QQQ': _snapshot('QQQ', 'US', '490.00', 'USD'),
    }
    results = calculate_allocation(portfolio, prices)
    total = sum(r.allocation_pct for r in results)
    assert abs(total - 100.0) < 0.01


def test_mixed_portfolio_bucket_allocation(fixture_prices_usd):
    portfolio = _load_fixture_portfolio('mixed')
    results = calculate_allocation(portfolio, fixture_prices_usd, exchange_rates=TWD_TO_USD)
    by_bucket = {r.bucket: r for r in results}
    # all target buckets present
    assert 'us_core_etf' in by_bucket
    assert 'taiwan_core_etf' in by_bucket
    assert 'taiwan_individual' in by_bucket
    assert 'cash_or_short_term' in by_bucket
    # VOO maps to us_core_etf
    assert 'VOO' in by_bucket['us_core_etf'].symbols
    # 0050.TW maps to taiwan_core_etf
    assert '0050.TW' in by_bucket['taiwan_core_etf'].symbols
    # allocations sum to 100 (holdings-only, cash bucket will be 0)
    total = sum(r.allocation_pct for r in results)
    assert abs(total - 100.0) < 0.01


# ─── cost_basis mode tests ────────────────────────────────────────────────────

def test_null_cost_basis_pure_drift_mode(balanced_portfolio, balanced_prices):
    # balanced_portfolio fixture has all cost_basis=None
    results = calculate_allocation(balanced_portfolio, balanced_prices)
    for r in results:
        assert r.tax_sensitive is False


def test_cost_basis_tax_sensitive_mode(balanced_prices):
    from investment_research.portfolio.models import CostBasis
    portfolio = Portfolio(
        name='tax-sensitive',
        allocation_targets=[
            AllocationTarget(bucket='us_core_etf', target_pct=100, drift_threshold_pct=5, markets=['US'], asset_types=['ETF']),
        ],
        holdings=[
            Holding(
                symbol='VOO', market='US', asset_type='ETF',
                quantity=Decimal('40'), currency='USD', target_bucket='us_core_etf',
                cost_basis=CostBasis(avg_cost=Decimal('380'), currency='USD', lot_method='fifo'),
            ),
        ],
    )
    results = calculate_allocation(portfolio, balanced_prices)
    us = next(r for r in results if r.bucket == 'us_core_etf')
    assert us.tax_sensitive is True


# ─── missing price graceful degradation ───────────────────────────────────────

def test_missing_price_graceful_degradation():
    """Symbol with no price snapshot is skipped; calculator does not crash."""
    portfolio = Portfolio(
        name='partial',
        allocation_targets=[
            AllocationTarget(bucket='us', target_pct=100, drift_threshold_pct=5, markets=['US'], asset_types=['ETF']),
        ],
        holdings=[
            Holding(symbol='VOO',     market='US', asset_type='ETF', quantity=Decimal('10'), currency='USD', target_bucket='us'),
            Holding(symbol='MISSING', market='US', asset_type='ETF', quantity=Decimal('10'), currency='USD', target_bucket='us'),
        ],
    )
    prices = {'VOO': _snapshot('VOO', 'US', '100.00')}  # MISSING has no price
    # should not raise
    results = calculate_allocation(portfolio, prices)
    assert len(results) == 1
    assert results[0].allocation_pct == pytest.approx(100.0, abs=0.01)
    assert 'VOO' in results[0].symbols
    assert 'MISSING' not in results[0].symbols


def test_all_prices_missing_returns_zero_allocations():
    portfolio = Portfolio(
        name='no-prices',
        allocation_targets=[
            AllocationTarget(bucket='us', target_pct=100, drift_threshold_pct=5, markets=['US'], asset_types=['ETF']),
        ],
        holdings=[
            Holding(symbol='VOO', market='US', asset_type='ETF', quantity=Decimal('10'), currency='USD', target_bucket='us'),
        ],
    )
    results = calculate_allocation(portfolio, {})
    assert results[0].allocation_pct == 0.0
    assert results[0].market_value_base == Decimal('0')
