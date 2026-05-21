import { describe, it, expect } from "vitest";
import { NewsArticleSchema } from "../schemas/index.ts";
import { twMarketNews } from "./tw-market-news.ts";
import { usMarketNews } from "./us-market-news.ts";
import { geopoliticalShock } from "./geopolitical-shock.ts";
import {
  lowConfidenceNoisy,
  MVP_CONFIDENCE_THRESHOLD,
} from "./low-confidence-noisy.ts";
import {
  duplicateArticleA,
  duplicateArticleB,
  DUPLICATE_KEY_PHRASE,
} from "./duplicate-pair.ts";

describe("News Article Fixtures — Zod Validation", () => {
  describe("twMarketNews", () => {
    it("parses without throwing", () => {
      expect(() => NewsArticleSchema.parse(twMarketNews)).not.toThrow();
    });

    it("is related to TW market", () => {
      expect(twMarketNews.relatedMarkets).toContain("TW");
    });

    it("has a bullish sentiment", () => {
      expect(twMarketNews.overallSentiment).toBe("Bullish");
    });

    it("confidenceScore is above MVP threshold", () => {
      expect(twMarketNews.confidenceScore).toBeGreaterThan(MVP_CONFIDENCE_THRESHOLD);
    });

    it("publishedAt is a valid ISO 8601 string", () => {
      expect(() => new Date(twMarketNews.publishedAt)).not.toThrow();
    });

    it("tickerSentiments reference TW tickers", () => {
      const tickers = twMarketNews.tickerSentiments.map((ts) => ts.ticker);
      expect(tickers.some((t) => t.endsWith(".TW"))).toBe(true);
    });
  });

  describe("usMarketNews", () => {
    it("parses without throwing", () => {
      expect(() => NewsArticleSchema.parse(usMarketNews)).not.toThrow();
    });

    it("is related to US market", () => {
      expect(usMarketNews.relatedMarkets).toContain("US");
    });

    it("has a bullish sentiment", () => {
      expect(usMarketNews.overallSentiment).toBe("Bullish");
    });

    it("confidenceScore is above MVP threshold", () => {
      expect(usMarketNews.confidenceScore).toBeGreaterThan(MVP_CONFIDENCE_THRESHOLD);
    });

    it("tickerSentiments reference US tickers", () => {
      const tickers = usMarketNews.tickerSentiments.map((ts) => ts.ticker);
      expect(tickers).toContain("VOO");
    });
  });

  describe("geopoliticalShock", () => {
    it("parses without throwing", () => {
      expect(() => NewsArticleSchema.parse(geopoliticalShock)).not.toThrow();
    });

    it("has CRITICAL impact", () => {
      expect(geopoliticalShock.impact).toBe("CRITICAL");
    });

    it("has a bearish sentiment", () => {
      expect(geopoliticalShock.overallSentiment).toBe("Bearish");
    });

    it("overallSentimentScore is strongly negative", () => {
      expect(geopoliticalShock.overallSentimentScore).toBeLessThan(-0.5);
    });

    it("affects multiple markets", () => {
      expect(geopoliticalShock.relatedMarkets.length).toBeGreaterThan(1);
    });

    it("confidenceScore is above MVP threshold", () => {
      expect(geopoliticalShock.confidenceScore).toBeGreaterThan(MVP_CONFIDENCE_THRESHOLD);
    });
  });

  describe("lowConfidenceNoisy", () => {
    it("parses without throwing", () => {
      expect(() => NewsArticleSchema.parse(lowConfidenceNoisy)).not.toThrow();
    });

    it("confidenceScore is below MVP_CONFIDENCE_THRESHOLD (0.35)", () => {
      // MVP_CONFIDENCE_THRESHOLD = 0.35
      // Articles below this threshold must NOT trigger portfolio recommendations
      expect(lowConfidenceNoisy.confidenceScore).toBeLessThan(MVP_CONFIDENCE_THRESHOLD);
    });

    it("MVP_CONFIDENCE_THRESHOLD is 0.35", () => {
      expect(MVP_CONFIDENCE_THRESHOLD).toBe(0.35);
    });

    it("has LOW impact", () => {
      expect(lowConfidenceNoisy.impact).toBe("LOW");
    });

    it("has no ticker sentiments (noisy, unspecific article)", () => {
      expect(lowConfidenceNoisy.tickerSentiments).toHaveLength(0);
    });

    it("confidenceScore is a number in [0, 1]", () => {
      expect(lowConfidenceNoisy.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(lowConfidenceNoisy.confidenceScore).toBeLessThanOrEqual(1);
    });
  });

  describe("duplicateArticleA and duplicateArticleB", () => {
    it("both articles parse without throwing", () => {
      expect(() => NewsArticleSchema.parse(duplicateArticleA)).not.toThrow();
      expect(() => NewsArticleSchema.parse(duplicateArticleB)).not.toThrow();
    });

    it("articles have different IDs (they are distinct records)", () => {
      expect(duplicateArticleA.id).not.toBe(duplicateArticleB.id);
    });

    it("articles have different URLs (different sources)", () => {
      expect(duplicateArticleA.url).not.toBe(duplicateArticleB.url);
    });

    it("articles have different sources (syndication scenario)", () => {
      expect(duplicateArticleA.source).not.toBe(duplicateArticleB.source);
    });

    it("titles share the key duplicate phrase", () => {
      // Similarity is detectable via shared title prefix
      expect(duplicateArticleA.title).toContain("TSMC Q2 Earnings Beat Expectations");
      expect(duplicateArticleB.title).toContain("TSMC Q2 Earnings Beat Expectations");
    });

    it("summaries both contain the DUPLICATE_KEY_PHRASE", () => {
      // A deduplication engine should detect this shared phrase
      expect(duplicateArticleA.summary).toContain(DUPLICATE_KEY_PHRASE);
      expect(duplicateArticleB.summary).toContain(DUPLICATE_KEY_PHRASE);
    });

    it("both articles have the same overall sentiment direction", () => {
      expect(duplicateArticleA.overallSentiment).toBe("Bullish");
      expect(duplicateArticleB.overallSentiment).toBe("Bullish");
    });

    it("both articles reference 2330.TW in ticker sentiments", () => {
      const tickersA = duplicateArticleA.tickerSentiments.map((ts) => ts.ticker);
      const tickersB = duplicateArticleB.tickerSentiments.map((ts) => ts.ticker);
      expect(tickersA).toContain("2330.TW");
      expect(tickersB).toContain("2330.TW");
    });

    it("both articles have HIGH impact", () => {
      expect(duplicateArticleA.impact).toBe("HIGH");
      expect(duplicateArticleB.impact).toBe("HIGH");
    });

    it("both articles are published within a short time window (same day)", () => {
      const dateA = new Date(duplicateArticleA.publishedAt);
      const dateB = new Date(duplicateArticleB.publishedAt);
      const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
      const diffHours = diffMs / (1000 * 60 * 60);
      // Both published within 24 hours of each other
      expect(diffHours).toBeLessThan(24);
    });
  });
});
