"""Pure feedback aggregation and threshold-tuning logic.

Stdlib only. These functions take plain (ticker, feedback_label) records and
emit per-ticker signals and threshold-change suggestions. No DB access here.
"""
from dataclasses import dataclass


@dataclass
class TickerSignal:
    ticker: str
    samples: int
    useful_rate: float
    noise_rate: float
    too_late_rate: float


@dataclass
class ThresholdSuggestion:
    ticker: str
    noise_rate: float
    samples: int
    current_severity_threshold: int
    suggested_severity_threshold: int
    rationale: str


def aggregate_feedback(records: list[tuple[str, str]]) -> list[TickerSignal]:
    """Group (ticker, feedback_label) records into per-ticker rate signals.

    samples is the total number of records for the ticker (not_useful counts
    toward samples but has no dedicated rate). Output is sorted by ticker for
    determinism.
    """
    by_ticker: dict[str, list[str]] = {}
    for ticker, label in records:
        by_ticker.setdefault(ticker, []).append(label)

    signals: list[TickerSignal] = []
    for ticker in sorted(by_ticker):
        labels = by_ticker[ticker]
        samples = len(labels)
        signals.append(
            TickerSignal(
                ticker=ticker,
                samples=samples,
                useful_rate=labels.count('useful') / samples,
                noise_rate=labels.count('too_noisy') / samples,
                too_late_rate=labels.count('too_late') / samples,
            )
        )
    return signals


def suggest_threshold_changes(
    signals: list[TickerSignal],
    noise_threshold: float = 0.5,
    current_threshold: int = 4,
) -> list[ThresholdSuggestion]:
    """Suggest raising the severity threshold for noisy tickers.

    A ticker whose noise_rate exceeds noise_threshold gets a suggestion to raise
    its severity threshold to min(current+1, 5). Tickers at or below the
    threshold yield no suggestion.
    """
    suggestions: list[ThresholdSuggestion] = []
    for signal in signals:
        if signal.noise_rate <= noise_threshold:
            continue
        suggestions.append(
            ThresholdSuggestion(
                ticker=signal.ticker,
                noise_rate=signal.noise_rate,
                samples=signal.samples,
                current_severity_threshold=current_threshold,
                suggested_severity_threshold=min(current_threshold + 1, 5),
                rationale=f'noise_rate > {noise_threshold:.0%} over rolling window',
            )
        )
    return suggestions
