"""Horizon return tests.

Filter: uv run pytest research/quant-python -k "evaluation" -v
"""
from decimal import Decimal

import pytest

from investment_research.evaluation import calculate_horizon_return


def test_5day_return_from_fixture():
    """A 5-trading-day path returns the entry->day5 percent change."""
    # 100 -> 105 over 5 trading days = +5%.
    price_path = [Decimal(p) for p in ('100', '101', '102', '103', '104', '105')]
    result = calculate_horizon_return(price_path, horizon_days=5)
    assert result.price_data_available is True
    assert result.return_pct == pytest.approx(5.0, abs=0.01)
    assert result.entry_price == Decimal('100')
    assert result.exit_price == Decimal('105')


def test_20day_return_buy_450_eval_460_is_2_2pct():
    """AC#1: buy at 450, evaluate at 460 after 20 trading days -> +2.22%."""
    price_path = [Decimal('450')] + [Decimal('455')] * 19 + [Decimal('460')]
    result = calculate_horizon_return(price_path, horizon_days=20)
    assert result.price_data_available is True
    assert result.return_pct == pytest.approx(2.22, abs=0.01)


def test_incomplete_path_marks_data_unavailable():
    """When the path is shorter than the horizon, no return is reported."""
    price_path = [Decimal('100'), Decimal('101'), Decimal('102')]
    result = calculate_horizon_return(price_path, horizon_days=20)
    assert result.price_data_available is False
    assert result.return_pct is None
    assert result.exit_price is None
