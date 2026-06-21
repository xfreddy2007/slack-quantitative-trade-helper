import { z } from 'zod'
import { MarketEnum } from './market.js'
import { ActionEnum } from './action.js'

export const RecommendationPayloadSchema = z.object({
  id: z.string(),
  market: MarketEnum,
  symbol: z.string(),
  action: ActionEnum,
  suggestedSizeMinPct: z.number().nullable().optional(),
  suggestedSizeMaxPct: z.number().nullable().optional(),
  rationale: z.string(),
  confidence: z.number().int().min(1).max(5),
  citations: z.array(z.string()).optional(),
  isPaperOnly: z.literal(true),
  createdAt: z.string().datetime(),
})

export type RecommendationPayload = z.infer<typeof RecommendationPayloadSchema>
