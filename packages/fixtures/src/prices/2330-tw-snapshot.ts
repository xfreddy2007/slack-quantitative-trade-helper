import { PriceSnapshotSchema, type PriceSnapshot } from "../schemas/index.ts";

const raw = {
  ticker: "2330.TW",
  name: "台積電 (Taiwan Semiconductor Manufacturing Co.)",
  assetType: "STOCK",
  market: "TW",
  currency: "TWD",
  price: 820.0,
  previousClose: 808.0,
  change: 12.0,
  changePercent: 0.01485,
  high: 825.0,
  low: 805.0,
  fiftyTwoWeekHigh: 843.0,
  fiftyTwoWeekLow: 516.0,
  volume: 28_763_000,
  snapshotAt: "2024-06-03T13:30:00.000+08:00",
  marketOpen: false,
} as const;

export const tw2330Snapshot: PriceSnapshot = PriceSnapshotSchema.parse(raw);
