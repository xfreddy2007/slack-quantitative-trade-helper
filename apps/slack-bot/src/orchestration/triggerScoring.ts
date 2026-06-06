import type { NormalizedNewsItem } from '../providers/adapter.js'

export type SuggestedAction = 'do_not_act' | 'monitor' | 'research_required' | 'reduce_position'

export interface TriggerScore {
  severity: number
  confidence: number
  relevance: number
  novelty?: number
  suggestedAction: SuggestedAction
  actionSize?: string
  rationale: string
  humanReviewRequired: boolean
  isDuplicate: boolean
  portfolioSymbols: string[]
  eventIds: string[]
}

const LOW_CONF_SIGNALS = ['anonymous', 'unverified', 'unclear', 'possible', 'rumor', 'unconfirmed']
const EXTREME_GLOBAL_SIGNALS = ['blockade', 'live-fire', 'live fire', 'naval vessel', 'pla', 'level-3 alert']

function deriveSeverity(item: NormalizedNewsItem): number {
  if (item.expected_severity !== undefined) return item.expected_severity
  const text = `${item.title} ${item.content}`.toLowerCase()
  if (item.market === 'GLOBAL') {
    return EXTREME_GLOBAL_SIGNALS.some((s) => text.includes(s)) ? 5 : 4
  }
  return 3
}

function deriveConfidence(item: NormalizedNewsItem): number {
  if (item.expected_confidence !== undefined) return item.expected_confidence
  const text = `${item.title} ${item.content}`.toLowerCase()
  return LOW_CONF_SIGNALS.some((s) => text.includes(s)) ? 1 : 3
}

function deriveRelevance(market: string): number {
  if (market === 'GLOBAL' || market === 'TW') return 4
  if (market === 'US') return 3
  return 2
}

function decideSuggestedAction(severity: number, confidence: number, relevance: number): SuggestedAction {
  if (relevance < 3) return 'do_not_act'
  if (severity >= 4 && confidence >= 3 && relevance >= 3) return 'reduce_position'
  if (severity === 5 && confidence <= 2) return 'research_required'
  return 'monitor'
}

export function scoreItem(
  item: NormalizedNewsItem,
  options?: { priorSeverity?: number }
): TriggerScore {
  const severity = deriveSeverity(item)
  const confidence = deriveConfidence(item)
  const relevance = deriveRelevance(item.market)
  const suggestedAction = decideSuggestedAction(severity, confidence, relevance)
  const isDuplicate = options?.priorSeverity !== undefined && severity <= options.priorSeverity

  return {
    severity,
    confidence,
    relevance,
    suggestedAction,
    rationale: `market=${item.market}, severity=${severity}, confidence=${confidence}, relevance=${relevance}`,
    humanReviewRequired: severity >= 4 && confidence <= 2,
    isDuplicate,
    portfolioSymbols: [],
    eventIds: [item.source_url],
  }
}
