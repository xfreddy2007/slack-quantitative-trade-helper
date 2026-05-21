import { NewsArticleSchema, type NewsArticle } from "../schemas/index.ts";

const raw = {
  id: "b2c3d4e5-0003-4000-8000-100000000003",
  title: "Taiwan Strait Tensions Escalate: Military Exercises Announced",
  url: "https://example-news.com/taiwan-strait-tensions-2024-06-02",
  summary:
    "Geopolitical tensions in the Taiwan Strait intensified after a major regional power announced large-scale military exercises near Taiwan's territorial waters. Markets reacted sharply: the TAIEX fell 3.2% in early trading, TSMC dropped 4.1%, and the Taiwan dollar weakened against the USD. Risk-off sentiment spread to Asian markets broadly.",
  source: "Global Risk Monitor",
  authors: ["James Park", "Aiko Tanaka", "Wei Zhang"],
  publishedAt: "2024-06-02T06:00:00.000+00:00",
  overallSentiment: "Bearish",
  overallSentimentScore: -0.85,
  confidenceScore: 0.93,
  impact: "CRITICAL",
  relatedMarkets: ["TW", "US", "JP", "HK"],
  tickerSentiments: [
    {
      ticker: "2330.TW",
      relevanceScore: 0.98,
      tickerSentimentScore: -0.88,
      tickerSentimentLabel: "Bearish",
    },
    {
      ticker: "0050.TW",
      relevanceScore: 0.92,
      tickerSentimentScore: -0.8,
      tickerSentimentLabel: "Bearish",
    },
    {
      ticker: "VOO",
      relevanceScore: 0.55,
      tickerSentimentScore: -0.35,
      tickerSentimentLabel: "Somewhat-Bearish",
    },
  ],
  tags: ["geopolitical", "taiwan-strait", "risk-off", "military", "critical"],
} as const;

export const geopoliticalShock: NewsArticle = NewsArticleSchema.parse(raw);
