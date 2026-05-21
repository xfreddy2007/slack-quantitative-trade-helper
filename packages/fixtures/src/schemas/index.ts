/**
 * Shared Zod schemas for the fixture library.
 *
 * Strategy: All objects use `.strict()` so that unexpected fields cause a
 * parse error at test time. This surfaces schema drift early.
 *
 * Monetary values: always `z.number()` — no string coercion.
 * Timestamps:      always ISO 8601 strings validated with `z.string().datetime()`.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** ISO 8601 datetime string, e.g. "2024-01-15T09:30:00.000Z" */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

/** A non-negative monetary value (USD or TWD — currency is tracked separately) */
export const MonetaryValueSchema = z.number().nonnegative();

/** A percentage expressed as a decimal, e.g. 0.05 = 5% */
export const DecimalPercentSchema = z.number();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const CurrencySchema = z.enum(["USD", "TWD", "EUR", "JPY", "GBP"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const AssetTypeSchema = z.enum(["ETF", "STOCK", "CASH", "BOND", "CRYPTO"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const MarketSchema = z.enum(["US", "TW", "HK", "JP", "EU"]);
export type Market = z.infer<typeof MarketSchema>;

export const SentimentSchema = z.enum(["Bullish", "Bearish", "Neutral", "Somewhat-Bullish", "Somewhat-Bearish"]);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const NewsImpactSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type NewsImpact = z.infer<typeof NewsImpactSchema>;

// ---------------------------------------------------------------------------
// Portfolio Schemas
// ---------------------------------------------------------------------------

export const HoldingSchema = z
  .object({
    ticker: z.string().min(1),
    name: z.string().min(1),
    assetType: AssetTypeSchema,
    market: MarketSchema,
    currency: CurrencySchema,
    /** Number of units held */
    quantity: z.number().positive(),
    /** Cost basis per unit in the holding's currency */
    costBasisPerUnit: MonetaryValueSchema,
    /** Weight as a decimal fraction of total portfolio value, e.g. 0.6 = 60% */
    targetWeight: DecimalPercentSchema,
  })
  .strict();

export type Holding = z.infer<typeof HoldingSchema>;

export const PortfolioConfigSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string(),
    baseCurrency: CurrencySchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    holdings: z.array(HoldingSchema).min(1),
    /** Total portfolio value in baseCurrency */
    totalValue: MonetaryValueSchema,
    /** Tags for filtering in tests */
    tags: z.array(z.string()),
  })
  .strict();

export type PortfolioConfig = z.infer<typeof PortfolioConfigSchema>;

// ---------------------------------------------------------------------------
// Price Snapshot Schemas
// ---------------------------------------------------------------------------

export const PriceSnapshotSchema = z
  .object({
    ticker: z.string().min(1),
    name: z.string().min(1),
    assetType: AssetTypeSchema,
    market: MarketSchema,
    currency: CurrencySchema,
    /** Current price in the asset's currency */
    price: MonetaryValueSchema,
    /** Previous close price */
    previousClose: MonetaryValueSchema,
    /** Absolute change from previous close */
    change: z.number(),
    /** Percentage change from previous close as a decimal */
    changePercent: DecimalPercentSchema,
    /** Intraday high */
    high: MonetaryValueSchema,
    /** Intraday low */
    low: MonetaryValueSchema,
    /** 52-week high */
    fiftyTwoWeekHigh: MonetaryValueSchema,
    /** 52-week low */
    fiftyTwoWeekLow: MonetaryValueSchema,
    /** Trading volume; 0 for cash placeholders */
    volume: z.number().int().nonnegative(),
    /** Timestamp of the snapshot */
    snapshotAt: IsoDateTimeSchema,
    /** Whether the market was open at snapshot time */
    marketOpen: z.boolean(),
  })
  .strict();

export type PriceSnapshot = z.infer<typeof PriceSnapshotSchema>;

// ---------------------------------------------------------------------------
// News Article Schemas
// ---------------------------------------------------------------------------

export const NewsTickerSentimentSchema = z
  .object({
    ticker: z.string().min(1),
    relevanceScore: z.number().min(0).max(1),
    tickerSentimentScore: z.number().min(-1).max(1),
    tickerSentimentLabel: SentimentSchema,
  })
  .strict();

export type NewsTickerSentiment = z.infer<typeof NewsTickerSentimentSchema>;

export const NewsArticleSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1),
    url: z.string().url(),
    /** Plain-text summary / body excerpt */
    summary: z.string(),
    source: z.string().min(1),
    authors: z.array(z.string()),
    publishedAt: IsoDateTimeSchema,
    /** Overall sentiment label for the article */
    overallSentiment: SentimentSchema,
    /** Overall sentiment score in [-1, 1] */
    overallSentimentScore: z.number().min(-1).max(1),
    /**
     * Confidence score in [0, 1].
     * MVP threshold: articles below 0.35 are considered low-confidence and
     * must NOT trigger portfolio recommendations.
     */
    confidenceScore: z.number().min(0).max(1),
    impact: NewsImpactSchema,
    relatedMarkets: z.array(MarketSchema),
    tickerSentiments: z.array(NewsTickerSentimentSchema),
    tags: z.array(z.string()),
  })
  .strict();

export type NewsArticle = z.infer<typeof NewsArticleSchema>;

// ---------------------------------------------------------------------------
// Provider Payload Schemas
// ---------------------------------------------------------------------------

/** Alpha Vantage — individual item in the feed array */
export const AlphaVantageNewsItemSchema = z
  .object({
    title: z.string(),
    url: z.string().url(),
    time_published: z.string().min(1),
    authors: z.array(z.string()),
    summary: z.string(),
    banner_image: z.string().nullable(),
    source: z.string(),
    category_within_source: z.string(),
    source_domain: z.string(),
    topics: z.array(
      z
        .object({
          topic: z.string(),
          relevance_score: z.string(),
        })
        .strict()
    ),
    overall_sentiment_score: z.number(),
    overall_sentiment_label: z.string(),
    ticker_sentiment: z.array(
      z
        .object({
          ticker: z.string(),
          relevance_score: z.string(),
          ticker_sentiment_score: z.string(),
          ticker_sentiment_label: z.string(),
        })
        .strict()
    ),
  })
  .strict();

export type AlphaVantageNewsItem = z.infer<typeof AlphaVantageNewsItemSchema>;

/** Alpha Vantage — top-level Market News & Sentiment response */
export const AlphaVantageMarketNewsResponseSchema = z
  .object({
    items: z.string(),
    sentiment_score_definition: z.string(),
    relevance_score_definition: z.string(),
    feed: z.array(AlphaVantageNewsItemSchema),
  })
  .strict();

export type AlphaVantageMarketNewsResponse = z.infer<typeof AlphaVantageMarketNewsResponseSchema>;

// TODO: align with provider adapter spec once Twinkle Hub adapter is finalised
/** Twinkle Hub — context response payload */
export const TwinkleHubContextResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    generatedAt: IsoDateTimeSchema,
    model: z.string().min(1),
    context: z
      .object({
        portfolioId: z.string().uuid(),
        summary: z.string(),
        riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
        recommendations: z.array(
          z
            .object({
              ticker: z.string(),
              action: z.enum(["BUY", "SELL", "HOLD", "REDUCE", "INCREASE"]),
              rationale: z.string(),
              confidence: z.number().min(0).max(1),
            })
            .strict()
        ),
        marketOutlook: z.string(),
        dataSourcesUsed: z.array(z.string()),
      })
      .strict(),
    metadata: z
      .object({
        latencyMs: z.number().int().nonnegative(),
        tokensUsed: z.number().int().nonnegative(),
        version: z.string(),
      })
      .strict(),
  })
  .strict();

export type TwinkleHubContextResponse = z.infer<typeof TwinkleHubContextResponseSchema>;
