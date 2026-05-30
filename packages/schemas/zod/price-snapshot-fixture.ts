import { z } from 'zod'
import { MarketEnum } from './market.js'

export const PriceSnapshotFixtureSchema = z.object({
  symbol: z.string().min(1),
  market: MarketEnum,
  price: z.number().positive(),
  currency: z.string().min(1),
  timestamp: z.string().datetime(),
  provider: z.string().min(1),
  volume: z.number().optional(),
  change_pct: z.number().optional(),
})

export type PriceSnapshotFixture = z.infer<typeof PriceSnapshotFixtureSchema>
