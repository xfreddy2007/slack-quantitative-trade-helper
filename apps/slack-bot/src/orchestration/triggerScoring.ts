import type { NormalizedNewsItem } from '../providers/adapter.js'

export const TRIGGER_MODEL_VERSION = 'trigger-scoring-v2'

export type SuggestedAction = 'do_not_act' | 'monitor' | 'research_required' | 'reduce_position'

/** Event directional polarity, derived from headline/body text. */
export type Polarity = 'bearish' | 'bullish' | 'neutral'

/**
 * How a recommendation/alert should be evaluated against market outcomes:
 *  - `acute`: short-lived shock; judge on 1d/5d (acute drawdowns are sharp and revert fast).
 *  - `allocation`: portfolio/allocation drift; judge on 21d/63d.
 */
export type EvalHorizonClass = 'acute' | 'allocation'

export interface TriggerScore {
  severity: number
  /**
   * Source **reliability** on a 1–5 scale (official/corroborated/specific = high; rumor/anonymous = low).
   * NOTE: confidence is NOT the probability of an adverse move — see `adverseLikelihood`.
   */
  confidence: number
  relevance: number
  novelty?: number
  /** Directional reading of the event (bearish/bullish/neutral). */
  polarity: Polarity
  /** Modeled probability (0–1) that the relevant holding moves materially against us. */
  adverseLikelihood: number
  /** Evaluation-horizon class for outcome scoring (acute vs allocation). */
  evalHorizonClass: EvalHorizonClass
  suggestedAction: SuggestedAction
  actionSize?: string
  rationale: string
  humanReviewRequired: boolean
  isDuplicate: boolean
  portfolioSymbols: string[]
  eventIds: string[]
}

// --- reliability (confidence) signals ---
const RUMOR_SIGNALS = ['anonymous', 'unverified', 'unconfirmed', 'rumor', 'social media', 'not corroborated', 'no official statement']
const HEDGE_SIGNALS = ['possible', 'unclear', 'not confirmed', 'were not confirmed', 'suggests', 'hinted']
const OFFICIAL_SIGNALS = ['announce', 'unveiled', 'fed ', 'federal reserve', 'fomc', 'posts record', 'reported', 'official', 'agree', 'framework', 'cuts rates', 'delivers']

// --- severity signals ---
const EXTREME_GLOBAL_SIGNALS = ['blockade', 'live-fire', 'live fire', 'naval vessel', 'pla', 'level-3 alert']
// Market-specific (TW/US) signals that make a single-market event genuinely high-severity.
const MARKET_EXTREME_SIGNALS = [
  'limit down', 'limit-down', '跌停', '限跌', '暴跌',
  'crash', 'record drop', 'record plunge', 'largest single-day', 'single-day drop on record',
]
const MARKET_HIGH_SIGNALS = [
  'plunge', 'rout', 'sharp pullback', 'sharp selloff', 'correction', 'slump',
  'surges most', 'biggest two-day', 'in decades', 'double digit',
]

// --- polarity signals ---
const BULLISH_SIGNALS = [
  'truce', 'pause', 'rebound', 'rally', 'relief', 'rate cut', 'rate-cut', 'cuts rates', 'cut rates',
  'record high', 'record profit', 'record quarterly', 'raises guidance', 'beat', 'agree', 'agreement',
  'deal', 'deals', 'framework', 'recovery', 'recover', 'eased', 'rolled back', 'roll back',
  'new high', 'new highs', 'optimism', 'surprise',
]
const BEARISH_SIGNALS = [
  'crash', 'plunge', 'rout', 'selloff', 'sell-off', 'slump', 'slide', 'war', 'strike', 'strikes',
  'sanction', 'tariff', 'blockade', 'live-fire', 'live fire', 'recession', 'default', 'credit stress',
  'limit down', 'limit-down', '跌停', '暴跌', '限跌', 'correction', 'pullback', 'spike', 'tension',
  'escalat', 'scare', 'shock', 'fears', 'wobble', 'risk-off',
]

// --- acute-shock signals (drive evalHorizonClass) ---
const ACUTE_SIGNALS = [
  'crash', 'plunge', 'rout', 'selloff', 'sell-off', 'limit down', 'limit-down', '跌停', '暴跌',
  'strike', 'war', 'spike', 'shock', 'pullback', 'correction', 'blockade', 'live-fire', 'live fire',
  'surge', 'slump', 'slide', 'wobble',
]

function itemText(item: NormalizedNewsItem): string {
  return `${item.title} ${item.content}`.toLowerCase()
}

function countHits(text: string, signals: string[]): number {
  return signals.reduce((n, s) => (text.includes(s) ? n + 1 : n), 0)
}

function deriveSeverity(item: NormalizedNewsItem): number {
  if (item.expected_severity !== undefined) return item.expected_severity
  const text = itemText(item)
  if (EXTREME_GLOBAL_SIGNALS.some((s) => text.includes(s))) return 5
  if (MARKET_EXTREME_SIGNALS.some((s) => text.includes(s))) return 5
  if (item.market === 'GLOBAL') return 4
  // TW/US: high-severity single-market signals lift an otherwise-suppressed 3 to a 4.
  if (MARKET_HIGH_SIGNALS.some((s) => text.includes(s))) return 4
  return 3
}

/**
 * Source reliability on a 1–5 scale. Higher = more trustworthy source/specificity.
 * Rumor/anonymous pulls down; official/corroborated/quantified pulls up.
 */
function deriveConfidence(item: NormalizedNewsItem): number {
  if (item.expected_confidence !== undefined) return item.expected_confidence
  const text = itemText(item)
  let c = 3 // default: moderate reliability
  if (RUMOR_SIGNALS.some((s) => text.includes(s))) c -= 2
  else if (HEDGE_SIGNALS.some((s) => text.includes(s))) c -= 1
  if (OFFICIAL_SIGNALS.some((s) => text.includes(s))) c += 1
  // a specific quantified magnitude (e.g. "17%", "25bp") signals a concrete, sourced claim
  if (/\d+(\.\d+)?\s?%|\d+\s?bp/.test(text)) c += 1
  return Math.max(1, Math.min(5, c))
}

function derivePolarity(item: NormalizedNewsItem): Polarity {
  const text = itemText(item)
  const bull = countHits(text, BULLISH_SIGNALS)
  const bear = countHits(text, BEARISH_SIGNALS)
  if (bear > bull) return 'bearish'
  if (bull > bear) return 'bullish'
  return 'neutral'
}

/**
 * Probability (0–1) that the relevant holding moves materially against us.
 * Distinct from `confidence` (reliability): driven by severity + direction.
 */
function deriveAdverseLikelihood(severity: number, polarity: Polarity): number {
  const sev = Math.max(3, Math.min(5, severity))
  if (polarity === 'bullish') return 0.1
  if (polarity === 'bearish') return 0.2 + 0.15 * (sev - 2) // sev3:0.35 sev4:0.50 sev5:0.65
  return 0.1 + 0.07 * (sev - 2) // neutral — sev3:0.17 sev4:0.24 sev5:0.31
}

function deriveEvalHorizonClass(item: NormalizedNewsItem, polarity: Polarity): EvalHorizonClass {
  const text = itemText(item)
  if (polarity === 'bearish' && ACUTE_SIGNALS.some((s) => text.includes(s))) return 'acute'
  return 'allocation'
}

function decideSuggestedAction(
  severity: number,
  confidence: number,
  relevance: number,
  polarity: Polarity
): SuggestedAction {
  if (relevance < 3) return 'do_not_act'
  if (severity >= 4 && confidence >= 3 && relevance >= 3) {
    // Only act-to-reduce on adverse (bearish) events; positive/risk-on events are monitor-only,
    // never "sell into a rally".
    return polarity === 'bearish' ? 'reduce_position' : 'monitor'
  }
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
  const polarity = derivePolarity(item)
  const adverseLikelihood = deriveAdverseLikelihood(severity, polarity)
  const evalHorizonClass = deriveEvalHorizonClass(item, polarity)
  const suggestedAction = decideSuggestedAction(severity, confidence, relevance, polarity)
  const isDuplicate = options?.priorSeverity !== undefined && severity <= options.priorSeverity

  return {
    severity,
    confidence,
    relevance,
    polarity,
    adverseLikelihood,
    evalHorizonClass,
    suggestedAction,
    rationale:
      `market=${item.market}, severity=${severity}, confidence=${confidence}, relevance=${relevance}, ` +
      `polarity=${polarity}, adverseLikelihood=${adverseLikelihood.toFixed(2)}, evalHorizon=${evalHorizonClass}`,
    humanReviewRequired: severity >= 4 && confidence <= 2,
    isDuplicate,
    portfolioSymbols: [],
    eventIds: [item.source_url],
  }
}

function deriveRelevance(market: string): number {
  if (market === 'GLOBAL' || market === 'TW') return 4
  if (market === 'US') return 3
  return 2
}
