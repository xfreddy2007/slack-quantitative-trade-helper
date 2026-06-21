"""Append-only writer for the feedback-driven TRIGGER_POLICY.md.

Each run appends a dated section. Prior content is never rewritten or deleted.
"""
from datetime import date
from pathlib import Path

from .aggregate import ThresholdSuggestion

_HEADER = '# Trigger Policy — Feedback-Driven Threshold Suggestions\n'

_TABLE_HEADER = (
    '| Ticker | Noise rate | Samples | Current threshold | '
    'Suggested threshold | Rationale |\n'
    '| --- | --- | --- | --- | --- | --- |\n'
)


def _default_path() -> Path:
    repo_root = Path(__file__).resolve().parents[5]
    return repo_root / 'knowledge' / 'schema' / 'TRIGGER_POLICY.md'


def render_section(suggestions: list[ThresholdSuggestion], today: date) -> str:
    """Render the dated Markdown section appended for a single run."""
    lines = [f'\n## {today.isoformat()}\n']
    if not suggestions:
        lines.append('\nno changes suggested\n')
        return ''.join(lines)

    lines.append(_TABLE_HEADER)
    for s in suggestions:
        lines.append(
            f'| {s.ticker} | {s.noise_rate:.0%} | {s.samples} | '
            f'{s.current_severity_threshold} | {s.suggested_severity_threshold} | '
            f'{s.rationale} |\n'
        )
    return ''.join(lines)


def append_trigger_policy(
    suggestions: list[ThresholdSuggestion],
    path: Path | None = None,
    today: date | None = None,
) -> Path:
    """Append a dated suggestions section to TRIGGER_POLICY.md (append-only).

    Writes the header once when the file does not yet exist, then appends the
    dated section. Existing content is always preserved.
    """
    target = path if path is not None else _default_path()
    when = today if today is not None else date.today()

    target.parent.mkdir(parents=True, exist_ok=True)
    new_file = not target.exists()
    with target.open('a', encoding='utf-8') as f:
        if new_file:
            f.write(_HEADER)
        f.write(render_section(suggestions, when))
    return target
