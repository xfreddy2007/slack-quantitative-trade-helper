import { describe, it, expect } from "vitest";
import {
  AlphaVantageMarketNewsResponseSchema,
  TwinkleHubContextResponseSchema,
} from "../schemas/index.ts";
import { alphaVantageMarketNews } from "./alpha-vantage-market-news.ts";
import { twinkleHubContext } from "./twinkle-hub-context.ts";

describe("Provider Payload Fixtures — Zod Validation", () => {
  describe("alphaVantageMarketNews", () => {
    it("parses without throwing", () => {
      expect(() =>
        AlphaVantageMarketNewsResponseSchema.parse(alphaVantageMarketNews)
      ).not.toThrow();
    });

    it("has required top-level key: items (string)", () => {
      expect(typeof alphaVantageMarketNews.items).toBe("string");
    });

    it("has required top-level key: sentiment_score_definition (string)", () => {
      expect(typeof alphaVantageMarketNews.sentiment_score_definition).toBe("string");
    });

    it("has required top-level key: relevance_score_definition (string)", () => {
      expect(typeof alphaVantageMarketNews.relevance_score_definition).toBe("string");
    });

    it("has required top-level key: feed (array)", () => {
      expect(Array.isArray(alphaVantageMarketNews.feed)).toBe(true);
    });

    it("feed is non-empty", () => {
      expect(alphaVantageMarketNews.feed.length).toBeGreaterThan(0);
    });

    it("each feed item has required fields: title, url, time_published, summary, source", () => {
      for (const item of alphaVantageMarketNews.feed) {
        expect(typeof item.title).toBe("string");
        expect(typeof item.url).toBe("string");
        expect(typeof item.time_published).toBe("string");
        expect(typeof item.summary).toBe("string");
        expect(typeof item.source).toBe("string");
      }
    });

    it("each feed item has overall_sentiment_score as a number", () => {
      for (const item of alphaVantageMarketNews.feed) {
        expect(typeof item.overall_sentiment_score).toBe("number");
      }
    });

    it("each feed item has ticker_sentiment as an array", () => {
      for (const item of alphaVantageMarketNews.feed) {
        expect(Array.isArray(item.ticker_sentiment)).toBe(true);
      }
    });

    it("each feed item has topics as an array", () => {
      for (const item of alphaVantageMarketNews.feed) {
        expect(Array.isArray(item.topics)).toBe(true);
      }
    });

    it("ticker_sentiment items have required fields typed correctly", () => {
      for (const item of alphaVantageMarketNews.feed) {
        for (const ts of item.ticker_sentiment) {
          expect(typeof ts.ticker).toBe("string");
          expect(typeof ts.relevance_score).toBe("string");
          expect(typeof ts.ticker_sentiment_score).toBe("string");
          expect(typeof ts.ticker_sentiment_label).toBe("string");
        }
      }
    });
  });

  describe("twinkleHubContext", () => {
    it("parses without throwing", () => {
      expect(() =>
        TwinkleHubContextResponseSchema.parse(twinkleHubContext)
      ).not.toThrow();
    });

    it("has required top-level key: requestId (string)", () => {
      expect(typeof twinkleHubContext.requestId).toBe("string");
    });

    it("has required top-level key: generatedAt (ISO 8601 string)", () => {
      expect(typeof twinkleHubContext.generatedAt).toBe("string");
      expect(() => new Date(twinkleHubContext.generatedAt)).not.toThrow();
    });

    it("has required top-level key: model (string)", () => {
      expect(typeof twinkleHubContext.model).toBe("string");
    });

    it("has required top-level key: context (object)", () => {
      expect(typeof twinkleHubContext.context).toBe("object");
      expect(twinkleHubContext.context).not.toBeNull();
    });

    it("has required top-level key: metadata (object)", () => {
      expect(typeof twinkleHubContext.metadata).toBe("object");
      expect(twinkleHubContext.metadata).not.toBeNull();
    });

    it("context.portfolioId is a string", () => {
      expect(typeof twinkleHubContext.context.portfolioId).toBe("string");
    });

    it("context.riskLevel is one of LOW | MEDIUM | HIGH", () => {
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(twinkleHubContext.context.riskLevel);
    });

    it("context.recommendations is an array", () => {
      expect(Array.isArray(twinkleHubContext.context.recommendations)).toBe(true);
    });

    it("each recommendation has action typed as a valid enum value", () => {
      const validActions = ["BUY", "SELL", "HOLD", "REDUCE", "INCREASE"];
      for (const rec of twinkleHubContext.context.recommendations) {
        expect(validActions).toContain(rec.action);
      }
    });

    it("each recommendation confidence is a number in [0, 1]", () => {
      for (const rec of twinkleHubContext.context.recommendations) {
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("metadata.latencyMs is a non-negative integer", () => {
      expect(twinkleHubContext.metadata.latencyMs).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(twinkleHubContext.metadata.latencyMs)).toBe(true);
    });

    it("metadata.tokensUsed is a non-negative integer", () => {
      expect(twinkleHubContext.metadata.tokensUsed).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(twinkleHubContext.metadata.tokensUsed)).toBe(true);
    });

    it("metadata.version is a string", () => {
      expect(typeof twinkleHubContext.metadata.version).toBe("string");
    });

    it("context.dataSourcesUsed is an array of strings", () => {
      expect(Array.isArray(twinkleHubContext.context.dataSourcesUsed)).toBe(true);
      for (const src of twinkleHubContext.context.dataSourcesUsed) {
        expect(typeof src).toBe("string");
      }
    });
  });
});
