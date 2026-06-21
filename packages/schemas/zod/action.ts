import { z } from 'zod'

export const ActionEnum = z.enum([
  'monitor',
  'hold',
  'add_position',
  'reduce_position',
  'rebalance',
  'hedge',
  'do_not_act',
  'research_required',
])
export type Action = z.infer<typeof ActionEnum>
