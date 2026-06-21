export type SuppressReason = 'low_confidence' | 'below_threshold' | 'low_relevance'

export interface ThresholdResult {
  decision: 'post' | 'suppress'
  reason?: SuppressReason
}

/**
 * PRD Section 16 default rule: severity >= 4 AND confidence >= 3 AND relevance >= 3.
 * Severity-5 overrides confidence and relevance checks.
 */
export function checkThreshold(severity: number, confidence: number, relevance: number): ThresholdResult {
  if (severity === 5) return { decision: 'post' }
  if (severity < 4) return { decision: 'suppress', reason: 'below_threshold' }
  if (confidence < 3) return { decision: 'suppress', reason: 'low_confidence' }
  if (relevance < 3) return { decision: 'suppress', reason: 'low_relevance' }
  return { decision: 'post' }
}
