import { z } from "zod";

export const holdingTypeSchema = z.enum(["etf", "stock", "cash"]);

export const holdingSchema = z.object({
  ticker: z.string().min(1),
  type: holdingTypeSchema,
  quantity: z.number().nonnegative(),
  costBasis: z.number().nonnegative(),
});

export const portfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  currency: z.string().length(3),
  holdings: z.array(holdingSchema).min(1),
});

export type Holding = z.infer<typeof holdingSchema>;
export type HoldingType = z.infer<typeof holdingTypeSchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;
