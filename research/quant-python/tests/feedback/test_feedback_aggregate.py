"""Unit tests for pure feedback aggregation.

Filter: uv run pytest research/quant-python -k "feedback" -v
"""
import pytest

from investment_research.feedback import TickerSignal, aggregate_feedback


def test_aggregate_voo_useful_and_noise_rates():
    """6 useful + 4 too_noisy for VOO → useful_rate 0.6, noise_rate 0.4 (AC#4)."""
    records = [('VOO', 'useful')] * 6 + [('VOO', 'too_noisy')] * 4
    signals = aggregate_feedback(records)

    assert len(signals) == 1
    signal = signals[0]
    assert signal.ticker == 'VOO'
    assert signal.samples == 10
    assert signal.useful_rate == pytest.approx(0.6)
    assert signal.noise_rate == pytest.approx(0.4)
    assert signal.too_late_rate == pytest.approx(0.0)


def test_aggregate_empty_input_returns_empty():
    assert aggregate_feedback([]) == []


def test_aggregate_multi_ticker_grouping_and_too_late_rate():
    """Multiple tickers are grouped, sorted, and too_late_rate is computed."""
    records = [
        ('QQQ', 'too_late'),
        ('VOO', 'useful'),
        ('QQQ', 'not_useful'),
        ('VOO', 'too_noisy'),
        ('QQQ', 'too_late'),
        ('QQQ', 'too_late'),
    ]
    signals = aggregate_feedback(records)

    assert [s.ticker for s in signals] == ['QQQ', 'VOO']
    qqq = signals[0]
    assert qqq.samples == 4
    assert qqq.too_late_rate == pytest.approx(0.75)
    assert qqq.useful_rate == pytest.approx(0.0)

    voo = signals[1]
    assert isinstance(voo, TickerSignal)
    assert voo.samples == 2
    assert voo.useful_rate == pytest.approx(0.5)
    assert voo.noise_rate == pytest.approx(0.5)
