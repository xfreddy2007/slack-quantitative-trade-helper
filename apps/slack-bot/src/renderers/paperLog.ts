import type { PaperRecommendation } from '@prisma/client'

const NO_RECORDS_MESSAGE = '尚無紙上交易紀錄。'

function formatRange(min: unknown, max: unknown): string {
  const minNum = min === null || min === undefined ? null : Number(min)
  const maxNum = max === null || max === undefined ? null : Number(max)

  if (minNum === null && maxNum === null) return '—'
  if (minNum !== null && maxNum !== null) return `${minNum}%–${maxNum}%`
  return `${minNum ?? maxNum}%`
}

export function renderPaperLog(records: PaperRecommendation[]): string {
  if (records.length === 0) return NO_RECORDS_MESSAGE

  const header = 'ID | Action | Symbol | Market | Suggested Range | Status'
  const rows = records.map((r) =>
    [
      r.id,
      r.action,
      r.symbol,
      r.market,
      formatRange(r.suggestedSizeMinPct, r.suggestedSizeMaxPct),
      r.evaluationStatus,
    ].join(' | ')
  )

  return ['Paper Recommendation Log（最近 10 筆）：', '```', header, '---', ...rows, '```'].join('\n')
}
