import { describe, it, expect } from "vitest";
import { newsArticleSchema } from "../schemas/news-article.schema.js";
import { twMarketNewsArticle } from "../news/tw-market-news.js";
import { usMarketNewsArticle } from "../news/us-market-news.js";
import { geopoliticalShockArticle } from "../news/geopolitical-shock.js";
import { lowConfidenceNoisyArticle } from "../news/low-confidence-noisy.js";
import { duplicateArticleA, duplicateArticleB } from "../news/duplicate-pair.js";

describe("News Article Fixtures — Zod Validation", () => {
  it("twMarketNewsArticle passes schema validation", () => {
    expect(() => newsArticleSchema.parse(twMarketNewsArticle)).not.toThrow();
  });

  it("twMarketNewsArticle has correct id", () => {
    const parsed = newsArticleSchema.parse(twMarketNewsArticle);
    expect(parsed.id).toBe("news-tw-market-001");
  });

  it("twMarketNewsArticle has high relevance and confidence", () => {
    const parsed = newsArticleSchema.parse(twMarketNewsArticle);
    expect(parsed.relevanceScore).toBeGreaterThan(0.8);
    expect(parsed.confidence).toBeGreaterThan(0.8);
  });

  it("twMarketNewsArticle publishedAt is a fixed ISO datetime", () => {
    const parsed = newsArticleSchema.parse(twMarketNewsArticle);
    expect(parsed.publishedAt).toBe("2024-01-15T03:00:00.000Z");
  });

  it("usMarketNewsArticle passes schema validation", () => {
    expect(() => newsArticleSchema.parse(usMarketNewsArticle)).not.toThrow();
  });

  it("usMarketNewsArticle has correct id", () => {
    const parsed = newsArticleSchema.parse(usMarketNewsArticle);
    expect(parsed.id).toBe("news-us-market-001");
  });

  it("usMarketNewsArticle source is Financial Times", () => {
    const parsed = newsArticleSchema.parse(usMarketNewsArticle);
    expect(parsed.source).toBe("Financial Times");
  });

  it("usMarketNewsArticle tickers include VOO", () => {
    const parsed = newsArticleSchema.parse(usMarketNewsArticle);
    expect(parsed.tickers).toContain("VOO");
  });

  it("geopoliticalShockArticle passes schema validation", () => {
    expect(() => newsArticleSchema.parse(geopoliticalShockArticle)).not.toThrow();
  });

  it("geopoliticalShockArticle has very high relevance and confidence", () => {
    const parsed = newsArticleSchema.parse(geopoliticalShockArticle);
    expect(parsed.relevanceScore).toBeGreaterThanOrEqual(0.95);
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("geopoliticalShockArticle tags include high-impact", () => {
    const parsed = newsArticleSchema.parse(geopoliticalShockArticle);
    expect(parsed.tags).toContain("high-impact");
  });

  it("lowConfidenceNoisyArticle passes schema validation", () => {
    expect(() => newsArticleSchema.parse(lowConfidenceNoisyArticle)).not.toThrow();
  });

  it("lowConfidenceNoisyArticle has low relevance score", () => {
    const parsed = newsArticleSchema.parse(lowConfidenceNoisyArticle);
    expect(parsed.relevanceScore).toBeLessThan(0.1);
  });

  it("lowConfidenceNoisyArticle has low confidence", () => {
    const parsed = newsArticleSchema.parse(lowConfidenceNoisyArticle);
    expect(parsed.confidence).toBeLessThan(0.2);
  });

  it("lowConfidenceNoisyArticle has no relevant tickers", () => {
    const parsed = newsArticleSchema.parse(lowConfidenceNoisyArticle);
    expect(parsed.tickers).toHaveLength(0);
  });

  it("duplicateArticleA passes schema validation", () => {
    expect(() => newsArticleSchema.parse(duplicateArticleA)).not.toThrow();
  });

  it("duplicateArticleB passes schema validation", () => {
    expect(() => newsArticleSchema.parse(duplicateArticleB)).not.toThrow();
  });

  it("duplicate pair articles have different ids", () => {
    const parsedA = newsArticleSchema.parse(duplicateArticleA);
    const parsedB = newsArticleSchema.parse(duplicateArticleB);
    expect(parsedA.id).not.toBe(parsedB.id);
  });

  it("duplicate pair articles have different sources", () => {
    const parsedA = newsArticleSchema.parse(duplicateArticleA);
    const parsedB = newsArticleSchema.parse(duplicateArticleB);
    expect(parsedA.source).not.toBe(parsedB.source);
  });

  it("duplicate pair articles share the same tickers", () => {
    const parsedA = newsArticleSchema.parse(duplicateArticleA);
    const parsedB = newsArticleSchema.parse(duplicateArticleB);
    expect(parsedA.tickers).toEqual(parsedB.tickers);
  });

  it("duplicate pair articles have similar titles (near-duplicate)", () => {
    const parsedA = newsArticleSchema.parse(duplicateArticleA);
    const parsedB = newsArticleSchema.parse(duplicateArticleB);
    expect(parsedA.title.toLowerCase()).toContain("tsmc");
    expect(parsedB.title.toLowerCase()).toContain("tsmc");
  });

  it("all news articles have relevanceScore and confidence between 0 and 1", () => {
    const articles = [
      twMarketNewsArticle,
      usMarketNewsArticle,
      geopoliticalShockArticle,
      lowConfidenceNoisyArticle,
      duplicateArticleA,
      duplicateArticleB,
    ];
    for (const article of articles) {
      const parsed = newsArticleSchema.parse(article);
      expect(parsed.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(parsed.relevanceScore).toBeLessThanOrEqual(1);
      expect(parsed.confidence).toBeGreaterThanOrEqual(0);
      expect(parsed.confidence).toBeLessThanOrEqual(1);
    }
  });
});
