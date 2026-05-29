import { z } from 'zod'
import { MarketEnum } from './market.js'

export const ProviderSourcePayloadSchema = z.object({
  provider: z.string(),
  url: z.string().url(),
  title: z.string(),
  publishedAt: z.string().datetime().nullable().optional(),
  retrievedAt: z.string().datetime(),
  author: z.string().nullable().optional(),
  market: MarketEnum,
  hash: z.string(),
  rawContent: z.string().optional(),
})

export type ProviderSourcePayload = z.infer<typeof ProviderSourcePayloadSchema>
