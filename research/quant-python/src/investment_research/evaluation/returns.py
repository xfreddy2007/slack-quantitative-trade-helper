"""Horizon return calculation for paper-recommendation evaluation.

Pure functions, Decimal-aware, stdlib only.
"""
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional


@dataclass
class ReturnResult:
    """Result of a horizon return calculation.

    price_data_available is False when the price path is too short to reach the
    requested horizon, in which case return_pct and exit_price are None.
    """

    return_pct: Optional[float]
    price_data_available: bool
    entry_price: Optional[Decimal]
    exit_price: Optional[Decimal]


def calculate_horizon_return(price_path: list[Decimal], horizon_days: int) -> ReturnResult:
    """Compute the percent return from the recommendation date to the horizon.

    Args:
        price_path: Daily prices where price_path[0] is the price at the
            recommendation date and price_path[i] is the price i trading days
            later. Must contain at least horizon_days + 1 entries to be complete.
        horizon_days: Number of trading days forward to evaluate.

    Returns:
        ReturnResult. When len(price_path) <= horizon_days the horizon has not
        been reached: price_data_available is False and return_pct is None.

    Example:
        Buy at 450, evaluate at 460 -> +2.22%.
    """
    if len(price_path) <= horizon_days:
        entry = price_path[0] if price_path else None
        return ReturnResult(
            return_pct=None,
            price_data_available=False,
            entry_price=entry,
            exit_price=None,
        )

    entry_price = price_path[0]
    exit_price = price_path[horizon_days]
    return_pct = float((exit_price - entry_price) / entry_price * Decimal('100'))

    return ReturnResult(
        return_pct=return_pct,
        price_data_available=True,
        entry_price=entry_price,
        exit_price=exit_price,
    )
