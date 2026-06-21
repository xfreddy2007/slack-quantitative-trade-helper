export interface RecommendedAdjustment {
  action: string
  bucket: string
  rationale: string
  confidence: number
}

export interface DailyRecommendationInput {
  market: 'TW' | 'US' | 'GLOBAL'
  recommendationDate: Date
  observations: string[]
  recommendedAdjustments: RecommendedAdjustment[]
  noActionRationale: string | null
  riskLevel: number | null
  confidence: number | null
}

const DEFAULT_NO_ACTION_RATIONALE = '目前無足夠訊號支持調整現有部位。'
const RISK_LEVEL_LABELS: Record<number, string> = { 1: '低', 2: '低', 3: '中', 4: '高', 5: '高' }

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function header(market: DailyRecommendationInput['market'], date: Date): string {
  const dateStr = isoDate(date)
  if (market === 'TW') return `台股開盤前建議｜${dateStr} 08:30`
  if (market === 'US') return `美股開盤前建議｜${dateStr} 21:00 / 22:00（台北時間，依美國日光節約時間調整）`
  return `每日建議｜${dateStr}`
}

function renderRiskLevel(riskLevel: number | null): string {
  if (riskLevel === null) return '風險等級：未評估'
  return `風險等級：${RISK_LEVEL_LABELS[riskLevel] ?? riskLevel}`
}

function renderConfidence(confidence: number | null): string {
  if (confidence === null) return '信心：未評估'
  return `信心：${confidence}/5`
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n')
}

export function renderDailyRecommendation(input: DailyRecommendationInput): string {
  const sections = [header(input.market, input.recommendationDate), '']

  sections.push('今日觀察：')
  sections.push(
    input.observations.length > 0
      ? bulletList(input.observations)
      : '- 目前無重大市場觀察事項。'
  )
  sections.push('')

  if (input.recommendedAdjustments.length > 0) {
    sections.push('可考慮調整：')
    sections.push(bulletList(input.recommendedAdjustments.map((a) => a.rationale)))
    sections.push('')
  }

  sections.push('不建議動作：')
  sections.push(`- ${input.noActionRationale ?? DEFAULT_NO_ACTION_RATIONALE}`)
  sections.push('')

  sections.push('Paper Recommendation:')
  sections.push('- Record only. No broker order should be sent.')
  sections.push('')

  sections.push(renderRiskLevel(input.riskLevel))
  sections.push(renderConfidence(input.confidence))

  return sections.join('\n')
}
