import { PortfolioConfigSchema, type PortfolioConfig } from "../schemas/index.ts";

const raw = {
  id: "a1b2c3d4-0002-4000-8000-000000000002",
  name: "US ETF Only Portfolio",
  description:
    "A portfolio composed exclusively of U.S.-listed ETFs. Used to test USD-denominated price feeds and U.S. market news filtering.",
  baseCurrency: "USD",
  createdAt: "2024-01-15T14:30:00.000+00:00",
  updatedAt: "2024-06-01T14:30:00.000+00:00",
  totalValue: 250_000,
  tags: ["us", "etf-only", "usd"],
  holdings: [
    {
      ticker: "VOO",
      name: "Vanguard S&P 500 ETF",
      assetType: "ETF",
      market: "US",
      currency: "USD",
      quantity: 200,
      costBasisPerUnit: 410.25,
      targetWeight: 0.5,
    },
    {
      ticker: "QQQ",
      name: "Invesco QQQ Trust (Nasdaq-100 ETF)",
      assetType: "ETF",
      market: "US",
      currency: "USD",
      quantity: 100,
      costBasisPerUnit: 380.0,
      targetWeight: 0.3,
    },
    {
      ticker: "VTI",
      name: "Vanguard Total Stock Market ETF",
      assetType: "ETF",
      market: "US",
      currency: "USD",
      quantity: 150,
      costBasisPerUnit: 220.5,
      targetWeight: 0.2,
    },
  ],
} as const;

export const usEtfOnlyPortfolio: PortfolioConfig = PortfolioConfigSchema.parse(raw);
