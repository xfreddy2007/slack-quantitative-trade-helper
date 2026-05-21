import { PriceSnapshotSchema, type PriceSnapshot } from "../schemas/index.ts";

const raw = {
  ticker: "0050.TW",
  name: "元大台灣50 (Yuanta Taiwan 50 ETF)",
  assetType: "ETF",
  market: "TW",
  currency: "TWD",
  price: 148.5,
  previousClose: 147.2,
  change: 1.3,
  changePercent: 0.00883,
  high: 149.0,
  low: 146.9,
  fiftyTwoWeekHigh: 155.0,
  fiftyTwoWeekLow: 118.3,
  volume: 12_540_000,
  snapshotAt: "2024-06-03T13:30:00.000+08:00",
  marketOpen: false,
} as const;

export const tw0050Snapshot: PriceSnapshot = PriceSnapshotSchema.parse(raw);
