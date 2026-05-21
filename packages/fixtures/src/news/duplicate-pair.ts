import { NewsArticleSchema, type NewsArticle } from "../schemas/index.ts";

/**
 * Duplicate-pair fixture.
 *
 * These two articles are near-duplicates. The similarity is detectable via:
 *   - `title`: both share the phrase "TSMC Q2 Earnings Beat Expectations"
 *   - `summary`: both share the core factual sentences about revenue and margin
 *   - `source`: different sources (wire service vs. financial blog) — this is
 *     the realistic scenario where the same story is syndicated
 *
 * A deduplication check should flag these as duplicates based on title/summary
 * cosine similarity or exact-phrase overlap. The shared key phrase is:
 *   "TSMC reported Q2 revenue of NT$673.5 billion, beating analyst estimates"
 */

const rawArticleA = {
  id: "b2c3d4e5-0005-4000-8000-100000000005",
  title: "TSMC Q2 Earnings Beat Expectations, Shares Surge",
  url: "https://example-news.com/tsmc-q2-earnings-beat-2024-07-18",
  summary:
    "TSMC reported Q2 revenue of NT$673.5 billion, beating analyst estimates by 4.2%. Net income rose 36% year-on-year. The company raised its full-year revenue guidance, citing strong AI chip demand. Shares of 2330.TW surged 3.8% on the news.",
  source: "Reuters Asia",
  authors: ["Michael Chen"],
  publishedAt: "2024-07-18T08:00:00.000+08:00",
  overallSentiment: "Bullish",
  overallSentimentScore: 0.81,
  confidenceScore: 0.94,
  impact: "HIGH",
  relatedMarkets: ["TW", "US"],
  tickerSentiments: [
    {
      ticker: "2330.TW",
      relevanceScore: 0.99,
      tickerSentimentScore: 0.85,
      tickerSentimentLabel: "Bullish",
    },
  ],
  tags: ["tsmc", "earnings", "q2", "beat", "ai"],
} as const;

const rawArticleB = {
  id: "b2c3d4e5-0006-4000-8000-100000000006",
  title: "TSMC Q2 Earnings Beat Expectations — What It Means for Investors",
  url: "https://example-finance-blog.com/tsmc-q2-2024-investor-take",
  summary:
    "TSMC reported Q2 revenue of NT$673.5 billion, beating analyst estimates by 4.2%. The chipmaker's gross margin expanded to 53.2%. With AI-driven demand accelerating, TSMC raised its full-year outlook. Investors in 2330.TW and related ETFs like 0050.TW stand to benefit.",
  source: "Finance Insider Blog",
  authors: ["Linda Wu"],
  publishedAt: "2024-07-18T09:45:00.000+08:00",
  overallSentiment: "Bullish",
  overallSentimentScore: 0.79,
  confidenceScore: 0.87,
  impact: "HIGH",
  relatedMarkets: ["TW", "US"],
  tickerSentiments: [
    {
      ticker: "2330.TW",
      relevanceScore: 0.97,
      tickerSentimentScore: 0.82,
      tickerSentimentLabel: "Bullish",
    },
    {
      ticker: "0050.TW",
      relevanceScore: 0.71,
      tickerSentimentScore: 0.65,
      tickerSentimentLabel: "Bullish",
    },
  ],
  tags: ["tsmc", "earnings", "q2", "beat", "ai", "investor"],
} as const;

export const duplicateArticleA: NewsArticle = NewsArticleSchema.parse(rawArticleA);
export const duplicateArticleB: NewsArticle = NewsArticleSchema.parse(rawArticleB);

/** The shared key phrase used to detect duplication */
export const DUPLICATE_KEY_PHRASE =
  "TSMC reported Q2 revenue of NT$673.5 billion, beating analyst estimates";
