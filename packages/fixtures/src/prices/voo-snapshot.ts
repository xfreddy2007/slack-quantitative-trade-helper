import { PriceSnapshotSchema, type PriceSnapshot } from "../schemas/index.ts";

const raw = {
  ticker: "VOO",
  name: "Vanguard S&P 500 ETF",
  assetType: "ETF",
  market: "US",
  currency: "USD",
  price: 452.38,
  previousClose: 449.12,
  change: 3.26,
  changePercent: 0.00726,
  high: 453.1,
  low: 448.75,
  fiftyTwoWeekHigh: 468.22,
  fiftyTwoWeekLow: 380.45,
  volume: 3_842_100,
  snapshotAt: "2024-06-01T20:00:00.000+00:00",
  marketOpen: false,
} as const;

export const vooSnapshot: PriceSnapshot = PriceSnapshotSchema.parse(raw);
