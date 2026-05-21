import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  IsoDateTimeSchema,
  MonetaryValueSchema,
  DecimalPercentSchema,
  CurrencySchema,
  AssetTypeSchema,
  MarketSchema,
  SentimentSchema,
  NewsImpactSchema,
  HoldingSchema,
  PortfolioConfigSchema,
  PriceSnapshotSchema,
  NewsTickerSentimentSchema,
  NewsArticleSchema,
  AlphaVantageNewsItemSchema,
  AlphaVantageMarketNewsResponseSchema,
  TwinkleHubContextResponseSchema,
} from "./index.ts";

describe("Shared Zod Schemas — Unit Tests", () => {
  describe("IsoDateTimeSchema", () => {
    it("accepts a valid UTC ISO 8601 datetime", () => {
      expect(() =>
        IsoDateTimeSchema.parse("2024-06-01T12:00:00.000Z")
      ).not.toThrow();
    });

    it("accepts a valid offset ISO 8601 datetime", () => {
      expect(() =>
        IsoDateTimeSchema.parse("2024-06-01T20:00:00.000+08:00")
      ).not.toThrow();
    });

    it("rejects a plain date string", () => {
      expect(() => IsoDateTimeSchema.parse("2024-06-01")).toThrow(z.ZodError);
    });

    it("rejects a non-string value", () => {
      expect(() => IsoDateTimeSchema.parse(1234567890)).toThrow(z.ZodError);
    });
  });

  describe("MonetaryValueSchema", () => {
    it("accepts zero", () => {
      expect(() => MonetaryValueSchema.parse(0)).not.toThrow();
    });

    it("accepts a positive number", () => {
      expect(() => MonetaryValueSchema.parse(452.38)).not.toThrow();
    });

    it("rejects a negative number", () => {
      expect(() => MonetaryValueSchema.parse(-1)).toThrow(z.ZodError);
    });

    it("rejects a string", () => {
      expect(() => MonetaryValueSchema.parse("100")).toThrow(z.ZodError);
    });
  });

  describe("CurrencySchema", () => {
    it("accepts USD", () => {
      expect(() => CurrencySchema.parse("USD")).not.toThrow();
    });

    it("accepts TWD", () => {
      expect(() => CurrencySchema.parse("TWD")).not.toThrow();
    });

    it("rejects an unknown currency", () => {
      expect(() => CurrencySchema.parse("CNY")).toThrow(z.ZodError);
    });
  });

  describe("AssetTypeSchema", () => {
    it("accepts ETF", () => {
      expect(() => AssetTypeSchema.parse("ETF")).not.toThrow();
    });

    it("accepts STOCK", () => {
      expect(() => AssetTypeSchema.parse("STOCK")).not.toThrow();
    });

    it("accepts CASH", () => {
      expect(() => AssetTypeSchema.parse("CASH")).not.toThrow();
    });

    it("rejects an unknown asset type", () => {
      expect(() => AssetTypeSchema.parse("FUTURES")).toThrow(z.ZodError);
    });
  });

  describe("MarketSchema", () => {
    it("accepts US", () => {
      expect(() => MarketSchema.parse("US")).not.toThrow();
    });

    it("accepts TW", () => {
      expect(() => MarketSchema.parse("TW")).not.toThrow();
    });

    it("rejects an unknown market", () => {
      expect(() => MarketSchema.parse("CN")).toThrow(z.ZodError);
    });
  });

  describe("SentimentSchema", () => {
    it("accepts all valid sentiment values", () => {
      const values = ["Bullish", "Bearish", "Neutral", "Somewhat-Bullish", "Somewhat-Bearish"];
      for (const v of values) {
        expect(() => SentimentSchema.parse(v)).not.toThrow();
      }
    });

    it("rejects an invalid sentiment", () => {
      expect(() => SentimentSchema.parse("Very-Bullish")).toThrow(z.ZodError);
    });
  });

  describe("NewsImpactSchema", () => {
    it("accepts all valid impact values", () => {
      const values = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      for (const v of values) {
        expect(() => NewsImpactSchema.parse(v)).not.toThrow();
      }
    });

    it("rejects an invalid impact", () => {
      expect(() => NewsImpactSchema.parse("EXTREME")).toThrow(z.ZodError);
    });
  });

  describe("HoldingSchema — strict mode", () => {
    const validHolding = {
      ticker: "VOO",
      name: "Vanguard S&P 500 ETF",
      assetType: "ETF",
      market: "US",
      currency: "USD",
      quantity: 100,
      costBasisPerUnit: 410.0,
      targetWeight: 0.5,
    };

    it("accepts a valid holding", () => {
      expect(() => HoldingSchema.parse(validHolding)).not.toThrow();
    });

    it("rejects an unexpected field (strict mode)", () => {
      expect(() =>
        HoldingSchema.parse({ ...validHolding, unexpectedField: "oops" })
      ).toThrow(z.ZodError);
    });

    it("rejects a missing required field", () => {
      const { ticker: _ticker, ...withoutTicker } = validHolding;
      expect(() => HoldingSchema.parse(withoutTicker)).toThrow(z.ZodError);
    });

    it("rejects a string monetary value (no coercion)", () => {
      expect(() =>
        HoldingSchema.parse({ ...validHolding, costBasisPerUnit: "410.00" })
      ).toThrow(z.ZodError);
    });
  });

  describe("PortfolioConfigSchema — strict mode", () => {
    it("rejects an unexpected top-level field", () => {
      const validPortfolio = {
        id: "a1b2c3d4-0001-4000-8000-000000000001",
        name: "Test",
        description: "Test portfolio",
        baseCurrency: "USD",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        totalValue: 1000,
        tags: [],
        holdings: [
          {
            ticker: "VOO",
            name: "Vanguard S&P 500 ETF",
            assetType: "ETF",
            market: "US",
            currency: "USD",
            quantity: 1,
            costBasisPerUnit: 1000,
            targetWeight: 1.0,
          },
        ],
        extraField: "should-fail",
      };
      expect(() => PortfolioConfigSchema.parse(validPortfolio)).toThrow(z.ZodError);
    });
  });

  describe("PriceSnapshotSchema — strict mode", () => {
    it("rejects an unexpected field", () => {
      const validSnapshot = {
        ticker: "VOO",
        name: "Vanguard S&P 500 ETF",
        assetType: "ETF",
        market: "US",
        currency: "USD",
        price: 452.38,
        previousClose: 449.12,
        change: 3.26,
        changePercent: 0.00726,
        high: 453.1,
        low: 448.75,
        fiftyTwoWeekHigh: 468.22,
        fiftyTwoWeekLow: 380.45,
        volume: 3842100,
        snapshotAt: "2024-06-01T20:00:00.000Z",
        marketOpen: false,
        unexpectedField: "oops",
      };
      expect(() => PriceSnapshotSchema.parse(validSnapshot)).toThrow(z.ZodError);
    });
  });

  describe("NewsArticleSchema — strict mode", () => {
    it("rejects an unexpected field", () => {
      const validArticle = {
        id: "b2c3d4e5-0001-4000-8000-100000000001",
        title: "Test Article",
        url: "https://example.com/article",
        summary: "A test article summary.",
        source: "Test Source",
        authors: [],
        publishedAt: "2024-06-01T12:00:00.000Z",
        overallSentiment: "Neutral",
        overallSentimentScore: 0.0,
        confidenceScore: 0.5,
        impact: "LOW",
        relatedMarkets: ["US"],
        tickerSentiments: [],
        tags: [],
        unexpectedField: "oops",
      };
      expect(() => NewsArticleSchema.parse(validArticle)).toThrow(z.ZodError);
    });
  });

  describe("NewsTickerSentimentSchema — strict mode", () => {
    it("accepts a valid ticker sentiment", () => {
      expect(() =>
        NewsTickerSentimentSchema.parse({
          ticker: "VOO",
          relevanceScore: 0.9,
          tickerSentimentScore: 0.7,
          tickerSentimentLabel: "Bullish",
        })
      ).not.toThrow();
    });

    it("rejects an unexpected field", () => {
      expect(() =>
        NewsTickerSentimentSchema.parse({
          ticker: "VOO",
          relevanceScore: 0.9,
          tickerSentimentScore: 0.7,
          tickerSentimentLabel: "Bullish",
          extra: "oops",
        })
      ).toThrow(z.ZodError);
    });
  });

  describe("AlphaVantageNewsItemSchema — strict mode", () => {
    it("rejects an unexpected field", () => {
      const validItem = {
        title: "Test",
        url: "https://example.com",
        time_published: "20240601T120000",
        authors: [],
        summary: "Summary",
        banner_image: null,
        source: "Source",
        category_within_source: "Finance",
        source_domain: "example.com",
        topics: [],
        overall_sentiment_score: 0.5,
        overall_sentiment_label: "Bullish",
        ticker_sentiment: [],
        unexpectedField: "oops",
      };
      expect(() => AlphaVantageNewsItemSchema.parse(validItem)).toThrow(z.ZodError);
    });
  });

  describe("AlphaVantageMarketNewsResponseSchema — strict mode", () => {
    it("rejects an unexpected top-level field", () => {
      const validResponse = {
        items: "1",
        sentiment_score_definition: "definition",
        relevance_score_definition: "definition",
        feed: [],
        unexpectedField: "oops",
      };
      expect(() =>
        AlphaVantageMarketNewsResponseSchema.parse(validResponse)
      ).toThrow(z.ZodError);
    });
  });

  describe("TwinkleHubContextResponseSchema — strict mode", () => {
    it("rejects an unexpected top-level field", () => {
      const validResponse = {
        requestId: "c3d4e5f6-0001-4000-8000-200000000001",
        generatedAt: "2024-06-03T12:00:00.000Z",
        model: "twinkle-hub-v1",
        context: {
          portfolioId: "a1b2c3d4-0003-4000-8000-000000000003",
          summary: "Summary",
          riskLevel: "LOW",
          recommendations: [],
          marketOutlook: "Neutral",
          dataSourcesUsed: [],
        },
        metadata: {
          latencyMs: 100,
          tokensUsed: 500,
          version: "1.0.0",
        },
        unexpectedField: "oops",
      };
      expect(() =>
        TwinkleHubContextResponseSchema.parse(validResponse)
      ).toThrow(z.ZodError);
    });
  });

  describe("DecimalPercentSchema", () => {
    it("accepts 0", () => {
      expect(() => DecimalPercentSchema.parse(0)).not.toThrow();
    });

    it("accepts a positive decimal", () => {
      expect(() => DecimalPercentSchema.parse(0.05)).not.toThrow();
    });

    it("accepts a negative decimal (for losses)", () => {
      expect(() => DecimalPercentSchema.parse(-0.03)).not.toThrow();
    });

    it("rejects a string", () => {
      expect(() => DecimalPercentSchema.parse("5%")).toThrow(z.ZodError);
    });
  });
});
