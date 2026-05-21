import { type PriceSnapshot } from "../schemas/price-snapshot.schema.js";

export const cashPlaceholderSnapshot: PriceSnapshot = {
  ticker: "CASH",
  price: 1.0,
  currency: "USD",
  timestamp: "2024-01-15T00:00:00.000Z",
  exchange: "N/A",
  change: 0,
  changePercent: 0,
  volume: 0,
};
