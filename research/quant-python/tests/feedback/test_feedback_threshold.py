"""Unit tests for threshold-change suggestions.

Filter: uv run pytest research/quant-python -k "feedback" -v
"""
from investment_research.feedback import (
    TickerSignal,
    suggest_threshold_changes,
)


def test_high_noise_rate_suggests_raising_threshold_to_five():
    """noise_rate 0.6 (>50%) → one suggestion, suggested threshold 5."""
    signals = [
        TickerSignal(
            ticker='VOO',
            samples=10,
            useful_rate=0.4,
            noise_rate=0.6,
            too_late_rate=0.0,
        )
    ]
    suggestions = suggest_threshold_changes(signals)

    assert len(suggestions) == 1
    s = suggestions[0]
    assert s.ticker == 'VOO'
    assert s.current_severity_threshold == 4
    assert s.suggested_severity_threshold == 5
    assert s.rationale == 'noise_rate > 50% over rolling window'


def test_low_noise_rate_yields_no_suggestion():
    """noise_rate 0.1 (<20%) → no suggestion."""
    signals = [
        TickerSignal(
            ticker='QQQ',
            samples=10,
            useful_rate=0.9,
            noise_rate=0.1,
            too_late_rate=0.0,
        )
    ]
    assert suggest_threshold_changes(signals) == []
