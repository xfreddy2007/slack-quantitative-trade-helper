"""Drawdown and volatility tests.

Filter: uv run pytest research/quant-python -k "evaluation" -v
"""
from decimal import Decimal

import pytest

from investment_research.evaluation import (
    annualized_volatility,
    compute_drawdown,
    risk_notes,
)


def test_drawdown_peak_to_trough_is_negative_25pct():
    """Path 100 -> 120 -> 90 -> 110: peak 120, trough 90 -> -25%."""
    price_path = [Decimal('100'), Decimal('120'), Decimal('90'), Decimal('110')]
    assert compute_drawdown(price_path) == pytest.approx(-25.0, abs=0.01)


def test_monotonic_rise_has_no_drawdown():
    price_path = [Decimal('100'), Decimal('110'), Decimal('120')]
    assert compute_drawdown(price_path) == 0.0


def test_annualized_volatility_positive_for_volatile_path():
    price_path = [Decimal('100'), Decimal('110'), Decimal('95'), Decimal('105'), Decimal('100')]
    vol = annualized_volatility(price_path)
    assert vol > 0.0


def test_annualized_volatility_zero_for_flat_path():
    price_path = [Decimal('100'), Decimal('100'), Decimal('100'), Decimal('100')]
    assert annualized_volatility(price_path) == pytest.approx(0.0, abs=1e-9)


def test_risk_notes_human_readable():
    price_path = [Decimal('100'), Decimal('120'), Decimal('90'), Decimal('110')]
    drawdown_note, volatility_note = risk_notes(price_path)
    assert 'peak-to-trough drawdown' in drawdown_note
    assert '-25.0%' in drawdown_note
    assert 'annualized volatility' in volatility_note
