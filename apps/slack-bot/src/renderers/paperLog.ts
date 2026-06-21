import type { PaperRecommendationWithEvaluations } from '../db/paperRecommendationRepository.js'

const NO_RECORDS_MESSAGE = '尚無紙上交易紀錄。'

function formatRange(min: unknown, max: unknown): string {
  const minNum = min === null || min === undefined ? null : Number(min)
  const maxNum = max === null || max === undefined ? null : Number(max)

  if (minNum === null && maxNum === null) return '—'
  if (minNum !== null && maxNum !== null) return `${minNum}%–${maxNum}%`
  return `${minNum ?? maxNum}%`
}

// Summarize the evaluated return at the longest horizon that has a return value, e.g. "+2.2% (20d)".
function formatReturnSummary(
  evaluations: PaperRecommendationWithEvaluations['paperEvaluations']
): string {
  const withReturn = evaluations.filter((e) => e.returnPct !== null && e.returnPct !== undefined)
  if (withReturn.length === 0) return '—'
  const longest = withReturn.reduce((a, b) => (b.horizonDays > a.horizonDays ? b : a))
  const pct = Number(longest.returnPct)
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% (${longest.horizonDays}d)`
}

export function renderPaperLog(records: PaperRecommendationWithEvaluations[]): string {
  if (records.length === 0) return NO_RECORDS_MESSAGE

  const header = 'ID | Action | Symbol | Market | Suggested Range | Status | Return'
  const rows = records.map((r) =>
    [
      r.id,
      r.action,
      r.symbol,
      r.market,
      formatRange(r.suggestedSizeMinPct, r.suggestedSizeMaxPct),
      r.evaluationStatus,
      formatReturnSummary(r.paperEvaluations),
    ].join(' | ')
  )

  return ['Paper Recommendation Log（最近 10 筆）：', '```', header, '---', ...rows, '```'].join('\n')
}
