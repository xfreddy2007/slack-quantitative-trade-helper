import { describe, it, expect } from "vitest";
import { portfolioSchema } from "../schemas/portfolio.schema.js";
import { taiwanEtfOnlyPortfolio } from "../portfolios/taiwan-etf-only.js";
import { usEtfOnlyPortfolio } from "../portfolios/us-etf-only.js";
import { mixedEtfStockPortfolio } from "../portfolios/mixed-etf-stock.js";

describe("Portfolio Fixtures — Zod Validation", () => {
  it("taiwanEtfOnlyPortfolio passes schema validation", () => {
    expect(() => portfolioSchema.parse(taiwanEtfOnlyPortfolio)).not.toThrow();
  });

  it("taiwanEtfOnlyPortfolio has correct id", () => {
    const parsed = portfolioSchema.parse(taiwanEtfOnlyPortfolio);
    expect(parsed.id).toBe("portfolio-tw-etf-001");
  });

  it("taiwanEtfOnlyPortfolio currency is TWD", () => {
    const parsed = portfolioSchema.parse(taiwanEtfOnlyPortfolio);
    expect(parsed.currency).toBe("TWD");
  });

  it("taiwanEtfOnlyPortfolio all holdings are ETFs", () => {
    const parsed = portfolioSchema.parse(taiwanEtfOnlyPortfolio);
    for (const holding of parsed.holdings) {
      expect(holding.type).toBe("etf");
    }
  });

  it("taiwanEtfOnlyPortfolio contains 0050.TW", () => {
    const parsed = portfolioSchema.parse(taiwanEtfOnlyPortfolio);
    const tickers = parsed.holdings.map((h) => h.ticker);
    expect(tickers).toContain("0050.TW");
  });

  it("usEtfOnlyPortfolio passes schema validation", () => {
    expect(() => portfolioSchema.parse(usEtfOnlyPortfolio)).not.toThrow();
  });

  it("usEtfOnlyPortfolio has correct id", () => {
    const parsed = portfolioSchema.parse(usEtfOnlyPortfolio);
    expect(parsed.id).toBe("portfolio-us-etf-001");
  });

  it("usEtfOnlyPortfolio currency is USD", () => {
    const parsed = portfolioSchema.parse(usEtfOnlyPortfolio);
    expect(parsed.currency).toBe("USD");
  });

  it("usEtfOnlyPortfolio all holdings are ETFs", () => {
    const parsed = portfolioSchema.parse(usEtfOnlyPortfolio);
    for (const holding of parsed.holdings) {
      expect(holding.type).toBe("etf");
    }
  });

  it("usEtfOnlyPortfolio contains VOO", () => {
    const parsed = portfolioSchema.parse(usEtfOnlyPortfolio);
    const tickers = parsed.holdings.map((h) => h.ticker);
    expect(tickers).toContain("VOO");
  });

  it("mixedEtfStockPortfolio passes schema validation", () => {
    expect(() => portfolioSchema.parse(mixedEtfStockPortfolio)).not.toThrow();
  });

  it("mixedEtfStockPortfolio has correct id", () => {
    const parsed = portfolioSchema.parse(mixedEtfStockPortfolio);
    expect(parsed.id).toBe("portfolio-mixed-001");
  });

  it("mixedEtfStockPortfolio contains both ETF and stock holdings", () => {
    const parsed = portfolioSchema.parse(mixedEtfStockPortfolio);
    const types = new Set(parsed.holdings.map((h) => h.type));
    expect(types.has("etf")).toBe(true);
    expect(types.has("stock")).toBe(true);
  });

  it("mixedEtfStockPortfolio contains a cash holding", () => {
    const parsed = portfolioSchema.parse(mixedEtfStockPortfolio);
    const types = parsed.holdings.map((h) => h.type);
    expect(types).toContain("cash");
  });

  it("all portfolio holdings have non-negative quantity and costBasis", () => {
    const portfolios = [
      taiwanEtfOnlyPortfolio,
      usEtfOnlyPortfolio,
      mixedEtfStockPortfolio,
    ];
    for (const portfolio of portfolios) {
      const parsed = portfolioSchema.parse(portfolio);
      for (const holding of parsed.holdings) {
        expect(holding.quantity).toBeGreaterThanOrEqual(0);
        expect(holding.costBasis).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
