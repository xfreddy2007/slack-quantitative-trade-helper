import { PortfolioConfigSchema, type PortfolioConfig } from "../schemas/index.ts";

const raw = {
  id: "a1b2c3d4-0001-4000-8000-000000000001",
  name: "Taiwan ETF Only Portfolio",
  description:
    "A portfolio composed exclusively of Taiwan-listed ETFs. Used to test TWD-denominated price feeds and Taiwan market news filtering.",
  baseCurrency: "TWD",
  createdAt: "2024-01-15T08:00:00.000+08:00",
  updatedAt: "2024-06-01T08:00:00.000+08:00",
  totalValue: 1_500_000,
  tags: ["taiwan", "etf-only", "twd"],
  holdings: [
    {
      ticker: "0050.TW",
      name: "元大台灣50 (Yuanta Taiwan 50 ETF)",
      assetType: "ETF",
      market: "TW",
      currency: "TWD",
      quantity: 2000,
      costBasisPerUnit: 135.5,
      targetWeight: 0.5,
    },
    {
      ticker: "0056.TW",
      name: "元大高股息 (Yuanta High Dividend ETF)",
      assetType: "ETF",
      market: "TW",
      currency: "TWD",
      quantity: 3000,
      costBasisPerUnit: 38.2,
      targetWeight: 0.3,
    },
    {
      ticker: "00878.TW",
      name: "國泰永續高股息 (Cathay Sustainable High Dividend ETF)",
      assetType: "ETF",
      market: "TW",
      currency: "TWD",
      quantity: 5000,
      costBasisPerUnit: 20.1,
      targetWeight: 0.2,
    },
  ],
} as const;

export const taiwanEtfOnlyPortfolio: PortfolioConfig = PortfolioConfigSchema.parse(raw);
