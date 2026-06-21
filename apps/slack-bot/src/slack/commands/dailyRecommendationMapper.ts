import type { DailyRecommendation } from '@prisma/client'
import type { DailyRecommendationInput, RecommendedAdjustment } from '../../renderers/dailyRecommendation.js'

export function toRenderInput(rec: DailyRecommendation): DailyRecommendationInput {
  const market = rec.market === 'TW' || rec.market === 'US' ? rec.market : 'GLOBAL'
  return {
    market,
    recommendationDate: rec.recommendationDate,
    observations: rec.observations,
    recommendedAdjustments: (rec.recommendedAdjustments ?? []) as unknown as RecommendedAdjustment[],
    noActionRationale: rec.noActionRationale,
    riskLevel: rec.riskLevel,
    confidence: rec.confidence,
  }
}
