import { type Portfolio } from "../schemas/portfolio.schema.js";

export const mixedEtfStockPortfolio: Portfolio = {
  id: "portfolio-mixed-001",
  name: "Mixed ETF and Stock Portfolio",
  currency: "USD",
  holdings: [
    {
      ticker: "VOO",
      type: "etf",
      quantity: 25,
      costBasis: 390.0,
    },
    {
      ticker: "0050.TW",
      type: "etf",
      quantity: 500,
      costBasis: 120.0,
    },
    {
      ticker: "AAPL",
      type: "stock",
      quantity: 100,
      costBasis: 175.5,
    },
    {
      ticker: "2330.TW",
      type: "stock",
      quantity: 200,
      costBasis: 580.0,
    },
    {
      ticker: "MSFT",
      type: "stock",
      quantity: 40,
      costBasis: 310.75,
    },
    {
      ticker: "CASH",
      type: "cash",
      quantity: 1,
      costBasis: 5000.0,
    },
  ],
};
