import { pathToFileURL } from 'url'
import {
  renderDailyRecommendation,
  type DailyRecommendationInput,
} from '../../../src/renderers/dailyRecommendation.js'

const SAMPLE_INPUT: DailyRecommendationInput = {
  market: 'TW',
  recommendationDate: new Date('2026-05-18T00:00:00Z'),
  observations: ['台股核心 ETF 權重仍在目標區間內。', '半導體族群風險偏中性。'],
  recommendedAdjustments: [
    {
      action: 'rebalance',
      bucket: 'taiwan_core_etf',
      rationale: '建議檢視是否再平衡 3-5% 至現金。',
      confidence: 4,
    },
  ],
  noActionRationale: '目前無足夠訊號支持大幅降低核心 ETF 持倉。',
  riskLevel: 3,
  confidence: 3,
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const first = renderDailyRecommendation(SAMPLE_INPUT)
  const second = renderDailyRecommendation({ ...SAMPLE_INPUT })

  if (first !== second) {
    console.error('SNAPSHOT MISMATCH: rendering the same recommendation twice produced different text')
    process.exit(1)
  }

  console.log(first)
  process.exit(0)
}
