from .allocation import AllocationResult


def detect_drift(results: list[AllocationResult]) -> list[AllocationResult]:
    """Return only buckets whose allocation has drifted beyond drift_threshold_pct.

    Args:
        results: Output of calculate_allocation().

    Returns:
        Subset of results where is_drifted is True. Empty list when everything
        is within threshold.
    """
    return [r for r in results if r.is_drifted]
