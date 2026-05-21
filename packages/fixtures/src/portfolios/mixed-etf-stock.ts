import { PortfolioConfigSchema, type PortfolioConfig } from "../schemas/index.ts";

const raw = {
  id: "a1b2c3d4-0003-4000-8000-000000000003",
  name: "Mixed ETF and Stock Portfolio",
  description:
    "A portfolio mixing Taiwan ETFs, U.S. ETFs, and an individual Taiwan stock (TSMC). Used to test cross-market, cross-currency, and mixed asset-type scenarios.",
  baseCurrency: "USD",
  createdAt: "2024-02-01T00:00:00.000+00:00",
  updatedAt: "2024-06-01T00:00:00.000+00:00",
  totalValue: 500_000,
  tags: ["mixed", "cross-market", "etf", "stock", "tsmc"],
  holdings: [
    {
      ticker: "VOO",
      name: "Vanguard S&P 500 ETF",
      assetType: "ETF",
      market: "US",
      currency: "USD",
      quantity: 150,
      costBasisPerUnit: 415.0,
      targetWeight: 0.35,
    },
    {
      ticker: "0050.TW",
      name: "元大台灣50 (Yuanta Taiwan 50 ETF)",
      assetType: "ETF",
      market: "TW",
      currency: "TWD",
      quantity: 1000,
      costBasisPerUnit: 138.0,
      targetWeight: 0.25,
    },
    {
      ticker: "2330.TW",
      name: "台積電 (Taiwan Semiconductor Manufacturing Co.)",
      assetType: "STOCK",
      market: "TW",
      currency: "TWD",
      quantity: 500,
      costBasisPerUnit: 680.0,
      targetWeight: 0.3,
    },
    {
      ticker: "CASH",
      name: "Cash Reserve (USD)",
      assetType: "CASH",
      market: "US",
      currency: "USD",
      quantity: 1,
      costBasisPerUnit: 50_000,
      targetWeight: 0.1,
    },
  ],
} as const;

export const mixedEtfStockPortfolio: PortfolioConfig = PortfolioConfigSchema.parse(raw);
