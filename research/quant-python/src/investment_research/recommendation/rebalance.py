from dataclasses import dataclass

from investment_research.portfolio.allocation import AllocationResult

HUMAN_REVIEW_PHRASE = 'Requires human review before acting.'


@dataclass
class RoutineRecommendation:
    """Advisory recommendation produced by routine rebalancing logic.

    Kept separate from event-driven recommendations (T2.2.2).
    """

    action: str
    bucket: str
    suggested_size_min_pct: float
    suggested_size_max_pct: float
    rationale: str
    confidence: float  # 0.0 – 1.0


def recommend_rebalance(
    allocation_results: list[AllocationResult],
    cash_pct: float,
    minimum_cash_pct: float = 5.0,
    tax_gain_threshold_pct: float = 20.0,
) -> list[RoutineRecommendation]:
    """Convert drift detection output into bounded advisory recommendations.

    Args:
        allocation_results: Output of calculate_allocation().
        cash_pct: Current cash percentage of total portfolio value.
        minimum_cash_pct: Cash floor. add_position is suppressed when
            cash_pct < minimum_cash_pct; rebalance is emitted instead.
        tax_gain_threshold_pct: When an over-allocated bucket is tax_sensitive
            and its unrealized_gain_pct is at/above this threshold, reduce_position
            is deferred and replaced by a monitor recommendation.

    Returns:
        Single do_not_act when all buckets are within threshold.
        Otherwise one RoutineRecommendation per drifted bucket.
        All non-do_not_act rationale strings include HUMAN_REVIEW_PHRASE.
    """
    drifted = [r for r in allocation_results if r.is_drifted]

    if not drifted:
        return [
            RoutineRecommendation(
                action='do_not_act',
                bucket='portfolio',
                suggested_size_min_pct=0.0,
                suggested_size_max_pct=0.0,
                rationale='All buckets within drift threshold.',
                confidence=1.0,
            )
        ]

    cash_floor_active = cash_pct < minimum_cash_pct
    recs: list[RoutineRecommendation] = []

    for result in drifted:
        drift_magnitude = abs(result.drift_pct)

        if drift_magnitude == 0.0:
            continue  # defensive: is_drifted should never be True when drift is 0

        if result.drift_pct < 0:
            if cash_floor_active:
                # Cash floor: suppress add_position; redirect to rebalance from overweight buckets.
                action = 'rebalance'
                rationale = (
                    f'Bucket {result.bucket} under-allocated by {drift_magnitude:.1f}% '
                    f'but cash ({cash_pct:.1f}%) is below minimum ({minimum_cash_pct:.1f}%). '
                    f'Fund by reducing overweight buckets rather than deploying new capital. '
                    f'{HUMAN_REVIEW_PHRASE}'
                )
            else:
                action = 'add_position'
                rationale = (
                    f'Bucket {result.bucket} under-allocated by {drift_magnitude:.1f}% '
                    f'(target {result.target_pct:.1f}%, actual {result.allocation_pct:.1f}%). '
                    f'{HUMAN_REVIEW_PHRASE}'
                )
        else:
            tax_deferral = (
                result.tax_sensitive
                and result.unrealized_gain_pct is not None
                and result.unrealized_gain_pct >= tax_gain_threshold_pct
            )
            if tax_deferral:
                action = 'monitor'
                rationale = (
                    f'Bucket {result.bucket} over-allocated by {drift_magnitude:.1f}% '
                    f'(target {result.target_pct:.1f}%, actual {result.allocation_pct:.1f}%), '
                    f'but it holds a large unrealized gain ({result.unrealized_gain_pct:.1f}%). '
                    f'Selling is deferred to avoid realising taxable gains; monitor instead. '
                    f'{HUMAN_REVIEW_PHRASE}'
                )
            else:
                action = 'reduce_position'
                rationale = (
                    f'Bucket {result.bucket} over-allocated by {drift_magnitude:.1f}% '
                    f'(target {result.target_pct:.1f}%, actual {result.allocation_pct:.1f}%). '
                    f'{HUMAN_REVIEW_PHRASE}'
                )

        suggested_size_max_pct = round(drift_magnitude, 2)
        suggested_size_min_pct = round(min(drift_magnitude * 0.5, suggested_size_max_pct), 2)

        denominator = result.drift_threshold_pct * 2
        confidence = round(min(1.0, drift_magnitude / denominator), 4) if denominator > 0 else 1.0

        recs.append(
            RoutineRecommendation(
                action=action,
                bucket=result.bucket,
                suggested_size_min_pct=suggested_size_min_pct,
                suggested_size_max_pct=suggested_size_max_pct,
                rationale=rationale,
                confidence=confidence,
            )
        )

    return recs
