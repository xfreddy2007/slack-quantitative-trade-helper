import { z } from 'zod'
import { MarketEnum } from './market.js'

export const CostBasisSchema = z.object({
  avg_cost: z.number().positive(),
  currency: z.string().min(1),
  lot_method: z.enum(['weighted_avg', 'fifo', 'lifo']),
})

export const AllocationTargetSchema = z.object({
  bucket: z.string().min(1),
  target_pct: z.number().min(0).max(100),
  drift_threshold_pct: z.number().min(0).max(100),
  markets: z.array(MarketEnum).min(1),
  asset_types: z.array(z.string().min(1)).min(1),
  allowed_symbols: z.array(z.string()).optional(),
  restricted_actions: z.array(z.string()).optional(),
})

export const HoldingSchema = z.object({
  symbol: z.string().min(1),
  market: MarketEnum,
  asset_type: z.string().min(1),
  quantity: z.number().positive(),
  currency: z.string().min(1),
  cost_basis: CostBasisSchema.nullish(),
  strategy: z.string().optional(),
  target_bucket: z.string().optional(),
  max_single_alert_sell_pct: z.number().min(0).max(100).optional(),
})

export const PortfolioFixtureSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  allocation_targets: z.array(AllocationTargetSchema).min(1),
  holdings: z.array(HoldingSchema).min(1),
})

export type CostBasis = z.infer<typeof CostBasisSchema>
export type AllocationTarget = z.infer<typeof AllocationTargetSchema>
export type Holding = z.infer<typeof HoldingSchema>
export type PortfolioFixture = z.infer<typeof PortfolioFixtureSchema>
