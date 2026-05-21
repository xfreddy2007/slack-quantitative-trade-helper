import { PriceSnapshotSchema, type PriceSnapshot } from "../schemas/index.ts";

/**
 * Cash placeholder snapshot.
 *
 * Cash positions are represented with a fixed price of 1.00 in their
 * denomination currency. Volume is 0 (cash does not trade). Change values
 * are always 0. The 52-week high/low are both 1.00 by convention.
 */
const raw = {
  ticker: "CASH",
  name: "Cash (USD)",
  assetType: "CASH",
  market: "US",
  currency: "USD",
  price: 1.0,
  previousClose: 1.0,
  change: 0.0,
  changePercent: 0.0,
  high: 1.0,
  low: 1.0,
  fiftyTwoWeekHigh: 1.0,
  fiftyTwoWeekLow: 1.0,
  volume: 0,
  snapshotAt: "2024-06-03T00:00:00.000+00:00",
  marketOpen: false,
} as const;

export const cashPlaceholderSnapshot: PriceSnapshot = PriceSnapshotSchema.parse(raw);
