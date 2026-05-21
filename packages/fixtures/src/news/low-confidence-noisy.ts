import { NewsArticleSchema, type NewsArticle } from "../schemas/index.ts";

/**
 * Low-confidence noisy article fixture.
 *
 * MVP_CONFIDENCE_THRESHOLD = 0.35
 *
 * Articles with a confidenceScore BELOW this threshold must NOT trigger
 * portfolio recommendations. This fixture is used to verify that the
 * recommendation engine correctly suppresses low-signal articles.
 *
 * This article has confidenceScore = 0.22, which is well below the threshold.
 */
export const MVP_CONFIDENCE_THRESHOLD = 0.35;

const raw = {
  id: "b2c3d4e5-0004-4000-8000-100000000004",
  title: "Rumours Swirl Around Unnamed Tech Giant Acquisition",
  url: "https://example-news.com/rumour-tech-acquisition-2024-05-30",
  summary:
    "Unverified social media posts suggest an unnamed technology conglomerate may be considering a major acquisition. No official sources have confirmed the reports, and the company in question has not responded to requests for comment. Analysts caution against reading too much into unsubstantiated rumours.",
  source: "Rumour Mill Blog",
  authors: [],
  publishedAt: "2024-05-30T14:00:00.000+00:00",
  overallSentiment: "Neutral",
  overallSentimentScore: 0.05,
  // confidenceScore is 0.22 — below MVP_CONFIDENCE_THRESHOLD (0.35)
  confidenceScore: 0.22,
  impact: "LOW",
  relatedMarkets: ["US"],
  tickerSentiments: [],
  tags: ["rumour", "unverified", "low-confidence", "noisy"],
} as const;

export const lowConfidenceNoisy: NewsArticle = NewsArticleSchema.parse(raw);
