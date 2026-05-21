import { z } from "zod";

export const priceSnapshotSchema = z.object({
  ticker: z.string().min(1),
  price: z.number().nonnegative(),
  currency: z.string().length(3),
  timestamp: z.string().datetime(),
  exchange: z.string().optional(),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  volume: z.number().nonnegative().optional(),
  marketCap: z.number().nonnegative().optional(),
});

export type PriceSnapshot = z.infer<typeof priceSnapshotSchema>;
