"""Tests for the append-only TRIGGER_POLICY.md writer.

Filter: uv run pytest research/quant-python -k "feedback" -v
"""
from datetime import date

from investment_research.feedback import (
    ThresholdSuggestion,
    append_trigger_policy,
)


def _suggestion(ticker: str) -> ThresholdSuggestion:
    return ThresholdSuggestion(
        ticker=ticker,
        noise_rate=0.6,
        samples=10,
        current_severity_threshold=4,
        suggested_severity_threshold=5,
        rationale='noise_rate > 50% over rolling window',
    )


def test_append_is_append_only_and_retains_prior_sections(tmp_path):
    """A second call appends a new dated section without deleting the first."""
    path = tmp_path / 'TRIGGER_POLICY.md'

    append_trigger_policy([_suggestion('VOO')], path=path, today=date(2026, 6, 1))
    first = path.read_text(encoding='utf-8')
    assert first.startswith('# Trigger Policy — Feedback-Driven Threshold Suggestions')
    assert '## 2026-06-01' in first
    assert 'VOO' in first

    append_trigger_policy([_suggestion('QQQ')], path=path, today=date(2026, 6, 20))
    second = path.read_text(encoding='utf-8')

    # File grew and both dated sections + old content are retained.
    assert len(second) > len(first)
    assert second.startswith(first)
    assert '## 2026-06-01' in second
    assert '## 2026-06-20' in second
    assert 'VOO' in second
    assert 'QQQ' in second
    # Header written exactly once.
    assert second.count('# Trigger Policy') == 1


def test_append_no_suggestions_notes_no_changes(tmp_path):
    path = tmp_path / 'TRIGGER_POLICY.md'
    append_trigger_policy([], path=path, today=date(2026, 6, 20))
    content = path.read_text(encoding='utf-8')
    assert '## 2026-06-20' in content
    assert 'no changes suggested' in content
