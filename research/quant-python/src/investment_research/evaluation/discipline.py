"""Allocation-discipline scoring for paper-recommendation evaluation.

Measures whether allocation moved closer to its target after the recommended
action. Classification vocabulary is improved | unchanged | worsened, matching
the paper_evaluations.disciplineClassification schema column.
"""
from dataclasses import dataclass

_EPSILON = 1e-9


@dataclass
class DisciplineResult:
    """Discipline scoring result.

    score is the signed improvement (dist_before - dist_after): positive means
    the allocation moved closer to target, negative means it drifted further.
    """

    score: float
    classification: str


def score_discipline(
    action: str,
    allocation_before_pct: float,
    allocation_after_pct: float,
    target_pct: float,
) -> DisciplineResult:
    """Score how the recommended action moved allocation toward its target.

    Args:
        action: The recommended action (e.g. 'reduce_position', 'monitor').
        allocation_before_pct: Allocation percent before acting.
        allocation_after_pct: Allocation percent after acting.
        target_pct: Target allocation percent.

    Returns:
        DisciplineResult with a signed score and a classification of
        'improved', 'unchanged', or 'worsened'.
    """
    dist_before = abs(allocation_before_pct - target_pct)
    dist_after = abs(allocation_after_pct - target_pct)
    improvement = dist_before - dist_after

    if action in ('do_not_act', 'monitor') and (
        abs(allocation_before_pct - allocation_after_pct) <= _EPSILON
    ):
        classification = 'unchanged'
    elif improvement > _EPSILON:
        classification = 'improved'
    elif improvement < -_EPSILON:
        classification = 'worsened'
    else:
        classification = 'unchanged'

    return DisciplineResult(score=float(improvement), classification=classification)
