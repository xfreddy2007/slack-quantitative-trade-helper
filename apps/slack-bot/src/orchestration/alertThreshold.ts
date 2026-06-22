export type SuppressReason = 'low_confidence' | 'below_threshold' | 'low_relevance'

export interface ThresholdResult {
  decision: 'post' | 'suppress'
  reason?: SuppressReason
}

/** Cutoffs for the post/suppress rule. Defaults are the PRD Section 16 production values. */
export interface ThresholdCutoffs {
  severity: number
  confidence: number
  relevance: number
}

export const DEFAULT_CUTOFFS: ThresholdCutoffs = { severity: 4, confidence: 3, relevance: 3 }

/**
 * PRD Section 16 default rule: severity >= 4 AND confidence >= 3 AND relevance >= 3.
 * Severity-5 overrides confidence and relevance checks.
 *
 * Cutoffs are parameterized (default = production values) so the robustness sweep
 * (docs/evaluation/06) can perturb them without forking the rule. Passing no cutoffs
 * reproduces production behavior exactly.
 */
export function checkThreshold(
  severity: number,
  confidence: number,
  relevance: number,
  cutoffs: ThresholdCutoffs = DEFAULT_CUTOFFS,
): ThresholdResult {
  if (severity === 5) return { decision: 'post' }
  if (severity < cutoffs.severity) return { decision: 'suppress', reason: 'below_threshold' }
  if (confidence < cutoffs.confidence) return { decision: 'suppress', reason: 'low_confidence' }
  if (relevance < cutoffs.relevance) return { decision: 'suppress', reason: 'low_relevance' }
  return { decision: 'post' }
}
