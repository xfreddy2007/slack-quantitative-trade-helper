import { z } from "zod";

export const twinkleHubMarketContextSchema = z.object({
  region: z.string().min(1),
  marketStatus: z.enum(["open", "closed", "pre-market", "after-hours"]),
  tradingDate: z.string().datetime(),
  indices: z.array(
    z.object({
      name: z.string().min(1),
      value: z.number(),
      change: z.number(),
      changePercent: z.number(),
    })
  ),
});

export const twinkleHubSentimentSignalSchema = z.object({
  ticker: z.string().min(1),
  signal: z.enum(["strong-buy", "buy", "neutral", "sell", "strong-sell"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  generatedAt: z.string().datetime(),
  sources: z.array(z.string()),
});

export const twinkleHubContextSchema = z.object({
  requestId: z.string().min(1),
  generatedAt: z.string().datetime(),
  marketContext: twinkleHubMarketContextSchema,
  sentimentSignals: z.array(twinkleHubSentimentSignalSchema),
  metadata: z.object({
    version: z.string(),
    provider: z.literal("twinkle-hub"),
    latencyMs: z.number().nonnegative(),
  }),
});

export type TwinkleHubMarketContext = z.infer<typeof twinkleHubMarketContextSchema>;
export type TwinkleHubSentimentSignal = z.infer<typeof twinkleHubSentimentSignalSchema>;
export type TwinkleHubContext = z.infer<typeof twinkleHubContextSchema>;
