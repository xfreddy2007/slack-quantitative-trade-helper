import { z } from 'zod'

export const MarketEnum = z.enum(['TW', 'US', 'GLOBAL'])
export type Market = z.infer<typeof MarketEnum>
