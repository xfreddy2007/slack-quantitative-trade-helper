import { describe, it, expect } from 'vitest'
import {
  renderDailyRecommendation,
  type DailyRecommendationInput,
} from '../../../src/renderers/dailyRecommendation.js'

const BASE_INPUT: DailyRecommendationInput = {
  market: 'TW',
  recommendationDate: new Date('2026-05-18T00:00:00Z'),
  observations: ['台股核心 ETF 權重仍在目標區間內。', '半導體族群風險偏中性。'],
  recommendedAdjustments: [
    { action: 'rebalance', bucket: 'taiwan_core_etf', rationale: '建議檢視是否再平衡 3-5% 至現金。', confidence: 4 },
  ],
  noActionRationale: '目前無足夠訊號支持大幅降低核心 ETF 持倉。',
  riskLevel: 3,
  confidence: 3,
}

describe('renderDailyRecommendation — required sections', () => {
  it('contains all three required section headers', () => {
    const text = renderDailyRecommendation(BASE_INPUT)
    expect(text).toContain('今日觀察')
    expect(text).toContain('可考慮調整')
    expect(text).toContain('不建議動作')
  })

  it('contains the paper-only disclaimer', () => {
    const text = renderDailyRecommendation(BASE_INPUT)
    expect(text).toContain('Paper Recommendation')
    expect(text).toContain('No broker order should be sent')
  })

  it('contains risk level and confidence score', () => {
    const text = renderDailyRecommendation(BASE_INPUT)
    expect(text).toContain('風險等級：中')
    expect(text).toContain('信心：3/5')
  })

  it('lists each observation as a bullet', () => {
    const text = renderDailyRecommendation(BASE_INPUT)
    expect(text).toContain('- 台股核心 ETF 權重仍在目標區間內。')
    expect(text).toContain('- 半導體族群風險偏中性。')
  })

  it('lists each recommended adjustment rationale as a bullet', () => {
    const text = renderDailyRecommendation(BASE_INPUT)
    expect(text).toContain('- 建議檢視是否再平衡 3-5% 至現金。')
  })

  it('renders provided no-action rationale verbatim', () => {
    const text = renderDailyRecommendation(BASE_INPUT)
    expect(text).toContain('- 目前無足夠訊號支持大幅降低核心 ETF 持倉。')
  })
})

describe('renderDailyRecommendation — market-specific header', () => {
  it('TW market: header contains 台股 and 08:30 schedule marker', () => {
    const text = renderDailyRecommendation({ ...BASE_INPUT, market: 'TW' })
    expect(text).toContain('台股')
    expect(text).toContain('08:30')
  })

  it('US market: header contains US/美股 and 21:00 or 22:00 schedule marker', () => {
    const text = renderDailyRecommendation({ ...BASE_INPUT, market: 'US' })
    expect(text).toMatch(/US|美股/)
    expect(text).toMatch(/21:00|22:00/)
  })

  it('header includes ISO date from recommendationDate', () => {
    const text = renderDailyRecommendation(BASE_INPUT)
    expect(text).toContain('2026-05-18')
  })
})

describe('renderDailyRecommendation — no-material-alerts state', () => {
  const noAlertsInput: DailyRecommendationInput = {
    ...BASE_INPUT,
    recommendedAdjustments: [],
    noActionRationale: '目前無足夠訊號支持調整現有部位。',
  }

  it('不建議動作 section has non-empty rationale when there are no adjustments', () => {
    const text = renderDailyRecommendation(noAlertsInput)
    expect(text).toContain('不建議動作')
    expect(text).toContain('- 目前無足夠訊號支持調整現有部位。')
  })

  it('falls back to a default rationale when noActionRationale is null', () => {
    const text = renderDailyRecommendation({ ...noAlertsInput, noActionRationale: null })
    const lines = text.split('\n')
    const idx = lines.findIndex((l) => l.includes('不建議動作'))
    expect(lines[idx + 1]).toMatch(/^- .+/)
    expect(lines[idx + 1].length).toBeGreaterThan(2)
  })
})

describe('renderDailyRecommendation — null risk level / confidence', () => {
  it('renders fallback labels when riskLevel and confidence are null', () => {
    const text = renderDailyRecommendation({ ...BASE_INPUT, riskLevel: null, confidence: null })
    expect(text).toContain('風險等級')
    expect(text).toContain('信心')
  })
})

describe('renderDailyRecommendation — determinism', () => {
  it('renders identical text for identical input (snapshot-stable)', () => {
    const a = renderDailyRecommendation(BASE_INPUT)
    const b = renderDailyRecommendation({ ...BASE_INPUT })
    expect(a).toBe(b)
  })
})
