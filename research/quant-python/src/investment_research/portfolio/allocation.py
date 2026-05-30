import logging
from dataclasses import dataclass, field
from decimal import Decimal

from .models import AllocationTarget, Portfolio, PriceSnapshot

logger = logging.getLogger(__name__)


@dataclass
class AllocationResult:
    """Computed allocation for a single target bucket."""

    bucket: str
    target_pct: float
    drift_threshold_pct: float
    allocation_pct: float
    drift_pct: float           # allocation_pct - target_pct
    is_drifted: bool           # abs(drift_pct) >= drift_threshold_pct
    market_value_base: Decimal  # total market value of bucket in base currency
    symbols: list[str] = field(default_factory=list)
    tax_sensitive: bool = False  # True if any holding in bucket has cost_basis set


def calculate_allocation(
    portfolio: Portfolio,
    prices: dict[str, PriceSnapshot],
    exchange_rates: dict[str, Decimal] | None = None,
) -> list[AllocationResult]:
    """Calculate current allocation percentages by target_bucket.

    Args:
        portfolio: Portfolio with holdings and allocation targets.
        prices: Map of symbol -> PriceSnapshot. Missing symbols are skipped with a warning.
        exchange_rates: Optional map of currency code -> multiplier to convert to base currency.
            Example: {'TWD': Decimal('0.031'), 'USD': Decimal('1.0')} normalises to USD.
            When None all prices are treated as the same base currency.

    Returns:
        List of AllocationResult, one per allocation_target bucket.
    """
    # --- compute market value per bucket ---
    bucket_values: dict[str, Decimal] = {t.bucket: Decimal('0') for t in portfolio.allocation_targets}
    bucket_symbols: dict[str, list[str]] = {t.bucket: [] for t in portfolio.allocation_targets}
    bucket_tax_sensitive: dict[str, bool] = {t.bucket: False for t in portfolio.allocation_targets}

    for holding in portfolio.holdings:
        if holding.target_bucket is None:
            logger.warning('Holding %s has no target_bucket — skipped', holding.symbol)
            continue

        if holding.target_bucket not in bucket_values:
            logger.warning(
                'Holding %s target_bucket "%s" not in allocation_targets — skipped',
                holding.symbol,
                holding.target_bucket,
            )
            continue

        snapshot = prices.get(holding.symbol)
        if snapshot is None:
            logger.warning(
                'No price snapshot for symbol %s — treating market value as 0',
                holding.symbol,
            )
            continue

        raw_value = holding.quantity * snapshot.price

        # apply exchange rate if provided
        if exchange_rates is not None:
            rate = exchange_rates.get(holding.currency, Decimal('1'))
            value_base = raw_value * rate
        else:
            value_base = raw_value

        bucket_values[holding.target_bucket] += value_base
        bucket_symbols[holding.target_bucket].append(holding.symbol)

        if holding.cost_basis is not None:
            bucket_tax_sensitive[holding.target_bucket] = True

    # --- compute total portfolio value ---
    total_value = sum(bucket_values.values())

    # --- build results ---
    results: list[AllocationResult] = []
    for target in portfolio.allocation_targets:
        mv = bucket_values[target.bucket]

        if total_value == Decimal('0'):
            alloc_pct = 0.0
        else:
            alloc_pct = float(mv / total_value * Decimal('100'))

        drift = alloc_pct - target.target_pct
        is_drifted = abs(drift) >= target.drift_threshold_pct

        results.append(
            AllocationResult(
                bucket=target.bucket,
                target_pct=target.target_pct,
                drift_threshold_pct=target.drift_threshold_pct,
                allocation_pct=round(alloc_pct, 4),
                drift_pct=round(drift, 4),
                is_drifted=is_drifted,
                market_value_base=mv,
                symbols=bucket_symbols[target.bucket],
                tax_sensitive=bucket_tax_sensitive[target.bucket],
            )
        )

    return results
