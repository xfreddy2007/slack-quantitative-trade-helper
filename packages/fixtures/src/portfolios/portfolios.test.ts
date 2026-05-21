import { describe, it, expect } from "vitest";
import { PortfolioConfigSchema } from "../schemas/index.ts";
import { taiwanEtfOnlyPortfolio } from "./taiwan-etf-only.ts";
import { usEtfOnlyPortfolio } from "./us-etf-only.ts";
import { mixedEtfStockPortfolio } from "./mixed-etf-stock.ts";

describe("Portfolio Config Fixtures — Zod Validation", () => {
  describe("taiwanEtfOnlyPortfolio", () => {
    it("parses without throwing", () => {
      expect(() => PortfolioConfigSchema.parse(taiwanEtfOnlyPortfolio)).not.toThrow();
    });

    it("has baseCurrency TWD", () => {
      expect(taiwanEtfOnlyPortfolio.baseCurrency).toBe("TWD");
    });

    it("contains only ETF holdings", () => {
      for (const holding of taiwanEtfOnlyPortfolio.holdings) {
        expect(holding.assetType).toBe("ETF");
      }
    });

    it("contains only TW market holdings", () => {
      for (const holding of taiwanEtfOnlyPortfolio.holdings) {
        expect(holding.market).toBe("TW");
      }
    });

    it("target weights sum to approximately 1.0", () => {
      const sum = taiwanEtfOnlyPortfolio.holdings.reduce(
        (acc, h) => acc + h.targetWeight,
        0
      );
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("all monetary values are non-negative numbers", () => {
      expect(taiwanEtfOnlyPortfolio.totalValue).toBeGreaterThan(0);
      for (const holding of taiwanEtfOnlyPortfolio.holdings) {
        expect(holding.costBasisPerUnit).toBeGreaterThanOrEqual(0);
        expect(holding.quantity).toBeGreaterThan(0);
      }
    });

    it("timestamps are ISO 8601 strings", () => {
      expect(() => new Date(taiwanEtfOnlyPortfolio.createdAt)).not.toThrow();
      expect(() => new Date(taiwanEtfOnlyPortfolio.updatedAt)).not.toThrow();
    });
  });

  describe("usEtfOnlyPortfolio", () => {
    it("parses without throwing", () => {
      expect(() => PortfolioConfigSchema.parse(usEtfOnlyPortfolio)).not.toThrow();
    });

    it("has baseCurrency USD", () => {
      expect(usEtfOnlyPortfolio.baseCurrency).toBe("USD");
    });

    it("contains only ETF holdings", () => {
      for (const holding of usEtfOnlyPortfolio.holdings) {
        expect(holding.assetType).toBe("ETF");
      }
    });

    it("contains only US market holdings", () => {
      for (const holding of usEtfOnlyPortfolio.holdings) {
        expect(holding.market).toBe("US");
      }
    });

    it("target weights sum to approximately 1.0", () => {
      const sum = usEtfOnlyPortfolio.holdings.reduce(
        (acc, h) => acc + h.targetWeight,
        0
      );
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("all monetary values are non-negative numbers", () => {
      expect(usEtfOnlyPortfolio.totalValue).toBeGreaterThan(0);
      for (const holding of usEtfOnlyPortfolio.holdings) {
        expect(holding.costBasisPerUnit).toBeGreaterThanOrEqual(0);
        expect(holding.quantity).toBeGreaterThan(0);
      }
    });
  });

  describe("mixedEtfStockPortfolio", () => {
    it("parses without throwing", () => {
      expect(() => PortfolioConfigSchema.parse(mixedEtfStockPortfolio)).not.toThrow();
    });

    it("contains both ETF and STOCK and CASH asset types", () => {
      const types = new Set(mixedEtfStockPortfolio.holdings.map((h) => h.assetType));
      expect(types.has("ETF")).toBe(true);
      expect(types.has("STOCK")).toBe(true);
      expect(types.has("CASH")).toBe(true);
    });

    it("contains both US and TW markets", () => {
      const markets = new Set(mixedEtfStockPortfolio.holdings.map((h) => h.market));
      expect(markets.has("US")).toBe(true);
      expect(markets.has("TW")).toBe(true);
    });

    it("contains TSMC (2330.TW) as an individual stock", () => {
      const tsmc = mixedEtfStockPortfolio.holdings.find((h) => h.ticker === "2330.TW");
      expect(tsmc).toBeDefined();
      expect(tsmc?.assetType).toBe("STOCK");
    });

    it("target weights sum to approximately 1.0", () => {
      const sum = mixedEtfStockPortfolio.holdings.reduce(
        (acc, h) => acc + h.targetWeight,
        0
      );
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });
});
