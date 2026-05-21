import { describe, it, expect } from "vitest";
import { PriceSnapshotSchema } from "../schemas/index.ts";
import { vooSnapshot } from "./voo-snapshot.ts";
import { tw0050Snapshot } from "./0050-tw-snapshot.ts";
import { tw2330Snapshot } from "./2330-tw-snapshot.ts";
import { cashPlaceholderSnapshot } from "./cash-placeholder-snapshot.ts";

describe("Price Snapshot Fixtures — Zod Validation", () => {
  describe("vooSnapshot", () => {
    it("parses without throwing", () => {
      expect(() => PriceSnapshotSchema.parse(vooSnapshot)).not.toThrow();
    });

    it("has ticker VOO", () => {
      expect(vooSnapshot.ticker).toBe("VOO");
    });

    it("is a US ETF denominated in USD", () => {
      expect(vooSnapshot.assetType).toBe("ETF");
      expect(vooSnapshot.market).toBe("US");
      expect(vooSnapshot.currency).toBe("USD");
    });

    it("price is a positive number", () => {
      expect(vooSnapshot.price).toBeGreaterThan(0);
    });

    it("change equals price minus previousClose", () => {
      expect(vooSnapshot.change).toBeCloseTo(
        vooSnapshot.price - vooSnapshot.previousClose,
        5
      );
    });

    it("high >= low", () => {
      expect(vooSnapshot.high).toBeGreaterThanOrEqual(vooSnapshot.low);
    });

    it("52-week high >= 52-week low", () => {
      expect(vooSnapshot.fiftyTwoWeekHigh).toBeGreaterThanOrEqual(
        vooSnapshot.fiftyTwoWeekLow
      );
    });

    it("snapshotAt is a valid ISO 8601 string", () => {
      expect(() => new Date(vooSnapshot.snapshotAt)).not.toThrow();
      expect(new Date(vooSnapshot.snapshotAt).toISOString()).toBeTruthy();
    });
  });

  describe("tw0050Snapshot", () => {
    it("parses without throwing", () => {
      expect(() => PriceSnapshotSchema.parse(tw0050Snapshot)).not.toThrow();
    });

    it("has ticker 0050.TW", () => {
      expect(tw0050Snapshot.ticker).toBe("0050.TW");
    });

    it("is a TW ETF denominated in TWD", () => {
      expect(tw0050Snapshot.assetType).toBe("ETF");
      expect(tw0050Snapshot.market).toBe("TW");
      expect(tw0050Snapshot.currency).toBe("TWD");
    });

    it("price is a positive number", () => {
      expect(tw0050Snapshot.price).toBeGreaterThan(0);
    });

    it("volume is a non-negative integer", () => {
      expect(tw0050Snapshot.volume).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(tw0050Snapshot.volume)).toBe(true);
    });
  });

  describe("tw2330Snapshot", () => {
    it("parses without throwing", () => {
      expect(() => PriceSnapshotSchema.parse(tw2330Snapshot)).not.toThrow();
    });

    it("has ticker 2330.TW", () => {
      expect(tw2330Snapshot.ticker).toBe("2330.TW");
    });

    it("is a TW STOCK denominated in TWD", () => {
      expect(tw2330Snapshot.assetType).toBe("STOCK");
      expect(tw2330Snapshot.market).toBe("TW");
      expect(tw2330Snapshot.currency).toBe("TWD");
    });

    it("price is a positive number", () => {
      expect(tw2330Snapshot.price).toBeGreaterThan(0);
    });

    it("high >= low", () => {
      expect(tw2330Snapshot.high).toBeGreaterThanOrEqual(tw2330Snapshot.low);
    });
  });

  describe("cashPlaceholderSnapshot", () => {
    it("parses without throwing", () => {
      expect(() => PriceSnapshotSchema.parse(cashPlaceholderSnapshot)).not.toThrow();
    });

    it("has ticker CASH", () => {
      expect(cashPlaceholderSnapshot.ticker).toBe("CASH");
    });

    it("is a CASH asset type", () => {
      expect(cashPlaceholderSnapshot.assetType).toBe("CASH");
    });

    it("price is exactly 1.00", () => {
      expect(cashPlaceholderSnapshot.price).toBe(1.0);
    });

    it("change is 0", () => {
      expect(cashPlaceholderSnapshot.change).toBe(0);
      expect(cashPlaceholderSnapshot.changePercent).toBe(0);
    });

    it("volume is 0 (cash does not trade)", () => {
      expect(cashPlaceholderSnapshot.volume).toBe(0);
    });

    it("52-week high and low are both 1.00", () => {
      expect(cashPlaceholderSnapshot.fiftyTwoWeekHigh).toBe(1.0);
      expect(cashPlaceholderSnapshot.fiftyTwoWeekLow).toBe(1.0);
    });
  });
});
