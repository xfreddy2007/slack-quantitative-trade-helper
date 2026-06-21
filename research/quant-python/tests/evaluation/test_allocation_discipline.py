"""Allocation-discipline scoring tests.

Classification vocabulary: improved | unchanged | worsened.

Filter: uv run pytest research/quant-python -k "evaluation" -v
"""
import pytest

from investment_research.evaluation import score_discipline


def test_improved_score():
    """Moving closer to target after a reduce_position -> improved."""
    result = score_discipline(
        action='reduce_position',
        allocation_before_pct=50.0,
        allocation_after_pct=42.0,
        target_pct=40.0,
    )
    assert result.classification == 'improved'
    assert result.score == pytest.approx(8.0, abs=0.01)


def test_unchanged_score():
    """A monitor action with no allocation change -> unchanged."""
    result = score_discipline(
        action='monitor',
        allocation_before_pct=40.0,
        allocation_after_pct=40.0,
        target_pct=40.0,
    )
    assert result.classification == 'unchanged'
    assert result.score == pytest.approx(0.0, abs=1e-9)


def test_worsened_score():
    """Drifting further from target -> worsened with negative score."""
    result = score_discipline(
        action='add_position',
        allocation_before_pct=42.0,
        allocation_after_pct=50.0,
        target_pct=40.0,
    )
    assert result.classification == 'worsened'
    assert result.score == pytest.approx(-8.0, abs=0.01)
