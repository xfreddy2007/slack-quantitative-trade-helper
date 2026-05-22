import { type Portfolio } from "../schemas/portfolio.schema.js";

export const usEtfOnlyPortfolio: Portfolio = {
  id: "portfolio-us-etf-001",
  name: "US ETF Only Portfolio",
  currency: "USD",
  holdings: [
    {
      ticker: "VOO",
      type: "etf",
      quantity: 50,
      costBasis: 380.25,
    },
    {
      ticker: "QQQ",
      type: "etf",
      quantity: 30,
      costBasis: 355.0,
    },
    {
      ticker: "VTI",
      type: "etf",
      quantity: 75,
      costBasis: 210.5,
    },
  ],
};
