import { type Portfolio } from "../schemas/portfolio.schema.js";

export const taiwanEtfOnlyPortfolio: Portfolio = {
  id: "portfolio-tw-etf-001",
  name: "Taiwan ETF Only Portfolio",
  currency: "TWD",
  holdings: [
    {
      ticker: "0050.TW",
      type: "etf",
      quantity: 1000,
      costBasis: 118.5,
    },
    {
      ticker: "0056.TW",
      type: "etf",
      quantity: 2000,
      costBasis: 32.1,
    },
    {
      ticker: "00878.TW",
      type: "etf",
      quantity: 3000,
      costBasis: 19.75,
    },
  ],
};
