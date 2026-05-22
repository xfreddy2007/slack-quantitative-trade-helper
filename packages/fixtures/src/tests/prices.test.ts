import { describe, it, expect } from "vitest";
import { priceSnapshotSchema } from "../schemas/price-snapshot.schema.js";
import { vooSnapshot } from "../prices/voo-snapshot.js";
import { tw0050Snapshot } from "../prices/0050-tw-snapshot.js";
import { tw2330Snapshot } from "../prices/2330-tw-snapshot.js";
import { cashPlaceholderSnapshot } from "../prices/cash-placeholder.js";

describe("Price Snapshot Fixtures — Zod Validation", () => {
  it("vooSnapshot passes schema validation", () => {
    expect(() => priceSnapshotSchema.parse(vooSnapshot)).not.toThrow();
  });

  it("vooSnapshot has correct ticker", () => {
    const parsed = priceSnapshotSchema.parse(vooSnapshot);
    expect(parsed.ticker).toBe("VOO");
  });

  it("vooSnapshot currency is USD", () => {
    const parsed = priceSnapshotSchema.parse(vooSnapshot);
    expect(parsed.currency).toBe("USD");
  });

  it("vooSnapshot timestamp is a valid ISO datetime", () => {
    const parsed = priceSnapshotSchema.parse(vooSnapshot);
    expect(parsed.timestamp).toBe("2024-01-15T21:00:00.000Z");
  });

  it("vooSnapshot price is positive", () => {
    const parsed = priceSnapshotSchema.parse(vooSnapshot);
    expect(parsed.price).toBeGreaterThan(0);
  });

  it("tw0050Snapshot passes schema validation", () => {
    expect(() => priceSnapshotSchema.parse(tw0050Snapshot)).not.toThrow();
  });

  it("tw0050Snapshot has correct ticker", () => {
    const parsed = priceSnapshotSchema.parse(tw0050Snapshot);
    expect(parsed.ticker).toBe("0050.TW");
  });

  it("tw0050Snapshot currency is TWD", () => {
    const parsed = priceSnapshotSchema.parse(tw0050Snapshot);
    expect(parsed.currency).toBe("TWD");
  });

  it("tw0050Snapshot timestamp is a valid ISO datetime", () => {
    const parsed = priceSnapshotSchema.parse(tw0050Snapshot);
    expect(parsed.timestamp).toBe("2024-01-15T05:30:00.000Z");
  });

  it("tw2330Snapshot passes schema validation", () => {
    expect(() => priceSnapshotSchema.parse(tw2330Snapshot)).not.toThrow();
  });

  it("tw2330Snapshot has correct ticker", () => {
    const parsed = priceSnapshotSchema.parse(tw2330Snapshot);
    expect(parsed.ticker).toBe("2330.TW");
  });

  it("tw2330Snapshot currency is TWD", () => {
    const parsed = priceSnapshotSchema.parse(tw2330Snapshot);
    expect(parsed.currency).toBe("TWD");
  });

  it("tw2330Snapshot exchange is TWSE", () => {
    const parsed = priceSnapshotSchema.parse(tw2330Snapshot);
    expect(parsed.exchange).toBe("TWSE");
  });

  it("cashPlaceholderSnapshot passes schema validation", () => {
    expect(() => priceSnapshotSchema.parse(cashPlaceholderSnapshot)).not.toThrow();
  });

  it("cashPlaceholderSnapshot ticker is CASH", () => {
    const parsed = priceSnapshotSchema.parse(cashPlaceholderSnapshot);
    expect(parsed.ticker).toBe("CASH");
  });

  it("cashPlaceholderSnapshot price is exactly 1.0", () => {
    const parsed = priceSnapshotSchema.parse(cashPlaceholderSnapshot);
    expect(parsed.price).toBe(1.0);
  });

  it("cashPlaceholderSnapshot change is 0", () => {
    const parsed = priceSnapshotSchema.parse(cashPlaceholderSnapshot);
    expect(parsed.change).toBe(0);
  });

  it("all price snapshots have non-negative prices", () => {
    const snapshots = [vooSnapshot, tw0050Snapshot, tw2330Snapshot, cashPlaceholderSnapshot];
    for (const snapshot of snapshots) {
      const parsed = priceSnapshotSchema.parse(snapshot);
      expect(parsed.price).toBeGreaterThanOrEqual(0);
    }
  });
});
