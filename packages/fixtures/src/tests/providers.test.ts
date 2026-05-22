import { describe, it, expect } from "vitest";
import {
  alphaVantageNewsSentimentSchema,
  alphaVantageFeedItemSchema,
  alphaVantageTickerSentimentSchema,
} from "../schemas/alpha-vantage.schema.js";
import {
  twinkleHubContextSchema,
  twinkleHubSentimentSignalSchema,
} from "../schemas/twinkle-hub.schema.js";
import { alphaVantageNewsSentimentPayload } from "../providers/alpha-vantage-news-sentiment.js";
import { twinkleHubContextPayload } from "../providers/twinkle-hub-context.js";

describe("Provider Payload Fixtures — Zod Validation", () => {
  it("alphaVantageNewsSentimentPayload passes schema validation", () => {
    expect(() =>
      alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload)
    ).not.toThrow();
  });

  it("alphaVantageNewsSentimentPayload has items field", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    expect(parsed.items).toBe("2");
  });

  it("alphaVantageNewsSentimentPayload has sentiment_score_definition", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    expect(parsed.sentiment_score_definition).toBeTruthy();
  });

  it("alphaVantageNewsSentimentPayload has relevance_score_definition", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    expect(parsed.relevance_score_definition).toBeTruthy();
  });

  it("alphaVantageNewsSentimentPayload feed has 2 items", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    expect(parsed.feed).toHaveLength(2);
  });

  it("alphaVantageNewsSentimentPayload first feed item passes feed item schema", () => {
    const firstItem = alphaVantageNewsSentimentPayload.feed[0];
    expect(() => alphaVantageFeedItemSchema.parse(firstItem)).not.toThrow();
  });

  it("alphaVantageNewsSentimentPayload second feed item passes feed item schema", () => {
    const secondItem = alphaVantageNewsSentimentPayload.feed[1];
    expect(() => alphaVantageFeedItemSchema.parse(secondItem)).not.toThrow();
  });

  it("alphaVantageNewsSentimentPayload feed items have valid sentiment labels", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    const validLabels = ["Bearish", "Somewhat-Bearish", "Neutral", "Somewhat-Bullish", "Bullish"];
    for (const item of parsed.feed) {
      expect(validLabels).toContain(item.overall_sentiment_label);
    }
  });

  it("alphaVantageNewsSentimentPayload ticker sentiments pass schema", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    for (const item of parsed.feed) {
      for (const tickerSentiment of item.ticker_sentiment) {
        expect(() => alphaVantageTickerSentimentSchema.parse(tickerSentiment)).not.toThrow();
      }
    }
  });

  it("alphaVantageNewsSentimentPayload first feed item has TSM ticker sentiment", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    const firstItem = parsed.feed[0];
    const tickers = firstItem?.ticker_sentiment.map((ts) => ts.ticker);
    expect(tickers).toContain("TSM");
  });

  it("alphaVantageNewsSentimentPayload second feed item has VOO ticker sentiment", () => {
    const parsed = alphaVantageNewsSentimentSchema.parse(alphaVantageNewsSentimentPayload);
    const secondItem = parsed.feed[1];
    const tickers = secondItem?.ticker_sentiment.map((ts) => ts.ticker);
    expect(tickers).toContain("VOO");
  });

  it("twinkleHubContextPayload passes schema validation", () => {
    expect(() => twinkleHubContextSchema.parse(twinkleHubContextPayload)).not.toThrow();
  });

  it("twinkleHubContextPayload has correct requestId", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    expect(parsed.requestId).toBe("twh-req-20240115-001");
  });

  it("twinkleHubContextPayload generatedAt is a fixed ISO datetime", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    expect(parsed.generatedAt).toBe("2024-01-15T21:30:00.000Z");
  });

  it("twinkleHubContextPayload metadata provider is twinkle-hub", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    expect(parsed.metadata.provider).toBe("twinkle-hub");
  });

  it("twinkleHubContextPayload metadata latencyMs is non-negative", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    expect(parsed.metadata.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("twinkleHubContextPayload marketContext has 3 indices", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    expect(parsed.marketContext.indices).toHaveLength(3);
  });

  it("twinkleHubContextPayload marketContext includes TAIEX", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    const indexNames = parsed.marketContext.indices.map((i) => i.name);
    expect(indexNames).toContain("TAIEX");
  });

  it("twinkleHubContextPayload has 3 sentiment signals", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    expect(parsed.sentimentSignals).toHaveLength(3);
  });

  it("twinkleHubContextPayload sentiment signals pass signal schema", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    for (const signal of parsed.sentimentSignals) {
      expect(() => twinkleHubSentimentSignalSchema.parse(signal)).not.toThrow();
    }
  });

  it("twinkleHubContextPayload sentiment signals have scores between -1 and 1", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    for (const signal of parsed.sentimentSignals) {
      expect(signal.score).toBeGreaterThanOrEqual(-1);
      expect(signal.score).toBeLessThanOrEqual(1);
    }
  });

  it("twinkleHubContextPayload sentiment signals have confidence between 0 and 1", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    for (const signal of parsed.sentimentSignals) {
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("twinkleHubContextPayload contains signal for 2330.TW", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    const tickers = parsed.sentimentSignals.map((s) => s.ticker);
    expect(tickers).toContain("2330.TW");
  });

  it("twinkleHubContextPayload contains signal for VOO", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    const tickers = parsed.sentimentSignals.map((s) => s.ticker);
    expect(tickers).toContain("VOO");
  });

  it("twinkleHubContextPayload marketStatus is a valid enum value", () => {
    const parsed = twinkleHubContextSchema.parse(twinkleHubContextPayload);
    const validStatuses = ["open", "closed", "pre-market", "after-hours"];
    expect(validStatuses).toContain(parsed.marketContext.marketStatus);
  });
});
