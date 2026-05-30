import { z } from 'zod'
import { MarketEnum } from './market.js'

export const NewsFixtureSchema = z.object({
  title: z.string().min(1),
  source_url: z.string().url(),
  market: MarketEnum,
  published_at: z.string().datetime(),
  content: z.string().min(1),
  expected_tags: z.array(z.string()).optional(),
  expected_severity: z.number().int().min(1).max(5).optional(),
  expected_confidence: z.number().int().min(1).max(5).optional(),
  author: z.string().optional(),
  provider: z.string().optional(),
})

export type NewsFixture = z.infer<typeof NewsFixtureSchema>
