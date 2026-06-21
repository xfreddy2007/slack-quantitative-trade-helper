"""Risk metrics (drawdown, volatility) for paper-recommendation evaluation.

Pure functions, Decimal-aware, stdlib math/statistics only.
"""
import math
import statistics
from decimal import Decimal


def compute_drawdown(price_path: list[Decimal]) -> float:
    """Maximum peak-to-trough decline over the price path, as a percent.

    Sign convention: a decline is returned as a NEGATIVE percent (e.g. -25.0
    for a 25% drop). A path that only rises returns 0.0. The trough is the
    lowest price occurring at or after the peak.

    Args:
        price_path: Daily prices, oldest first.

    Returns:
        The largest peak-to-trough decline as a negative percent, or 0.0.
    """
    if len(price_path) < 2:
        return 0.0

    max_decline = Decimal('0')  # most negative seen
    peak = price_path[0]
    for price in price_path:
        if price > peak:
            peak = price
        if peak > 0:
            decline = (price - peak) / peak * Decimal('100')
            if decline < max_decline:
                max_decline = decline

    return float(max_decline)


def annualized_volatility(price_path: list[Decimal], trading_days: int = 252) -> float:
    """Annualized volatility from daily simple returns, as a percent.

    Computes the sample standard deviation of daily simple returns and scales
    by sqrt(trading_days).

    Args:
        price_path: Daily prices, oldest first. Needs at least 3 points for a
            sample stdev over at least 2 returns.
        trading_days: Trading days per year used for annualization.

    Returns:
        Annualized volatility as a percent. Returns 0.0 when there are too few
        points to compute a sample standard deviation.
    """
    if len(price_path) < 3:
        return 0.0

    daily_returns: list[float] = []
    for prev, curr in zip(price_path, price_path[1:]):
        if prev > 0:
            daily_returns.append(float((curr - prev) / prev))

    if len(daily_returns) < 2:
        return 0.0

    return statistics.stdev(daily_returns) * math.sqrt(trading_days) * 100.0


def risk_notes(price_path: list[Decimal]) -> tuple[str, str]:
    """Human-readable drawdown and volatility notes.

    Returns:
        (drawdown_note, volatility_note), e.g.
        ("peak-to-trough drawdown -8.3%", "annualized volatility 12.4%").
    """
    drawdown = compute_drawdown(price_path)
    volatility = annualized_volatility(price_path)
    drawdown_note = f'peak-to-trough drawdown {drawdown:.1f}%'
    volatility_note = f'annualized volatility {volatility:.1f}%'
    return drawdown_note, volatility_note
