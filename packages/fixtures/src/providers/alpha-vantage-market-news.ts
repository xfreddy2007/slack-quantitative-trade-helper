import {
  AlphaVantageMarketNewsResponseSchema,
  type AlphaVantageMarketNewsResponse,
} from "../schemas/index.ts";

// TODO: align with provider adapter spec once Alpha Vantage adapter is finalised
const raw = {
  items: "2",
  sentiment_score_definition:
    "x <= -0.35: Bearish; -0.35 < x <= -0.15: Somewhat-Bearish; -0.15 < x < 0.15: Neutral; 0.15 <= x < 0.35: Somewhat-Bullish; x >= 0.35: Bullish",
  relevance_score_definition:
    "0 < x <= 1, with a higher score indicating higher relevance.",
  feed: [
    {
      title: "S&P 500 Closes at Record High Amid Strong Jobs Data",
      url: "https://example-news.com/sp500-record-jobs-2024-06-01",
      time_published: "20240601T213000",
      authors: ["Sarah Johnson"],
      summary:
        "The S&P 500 index closed at an all-time high on Friday after the U.S. Labor Department reported stronger-than-expected non-farm payrolls.",
      banner_image: null,
      source: "Market Watch Daily",
      category_within_source: "Financial Markets",
      source_domain: "example-news.com",
      topics: [
        { topic: "Financial Markets", relevance_score: "0.9" },
        { topic: "Economy - Macro", relevance_score: "0.75" },
      ],
      overall_sentiment_score: 0.68,
      overall_sentiment_label: "Bullish",
      ticker_sentiment: [
        {
          ticker: "VOO",
          relevance_score: "0.88",
          ticker_sentiment_score: "0.7",
          ticker_sentiment_label: "Bullish",
        },
        {
          ticker: "QQQ",
          relevance_score: "0.75",
          ticker_sentiment_score: "0.62",
          ticker_sentiment_label: "Bullish",
        },
      ],
    },
    {
      title: "Taiwan Strait Tensions Escalate: Military Exercises Announced",
      url: "https://example-news.com/taiwan-strait-tensions-2024-06-02",
      time_published: "20240602T060000",
      authors: ["James Park", "Aiko Tanaka"],
      summary:
        "Geopolitical tensions in the Taiwan Strait intensified after a major regional power announced large-scale military exercises near Taiwan's territorial waters.",
      banner_image: null,
      source: "Global Risk Monitor",
      category_within_source: "Geopolitics",
      source_domain: "example-news.com",
      topics: [
        { topic: "Geopolitics", relevance_score: "0.98" },
        { topic: "Financial Markets", relevance_score: "0.82" },
      ],
      overall_sentiment_score: -0.85,
      overall_sentiment_label: "Bearish",
      ticker_sentiment: [
        {
          ticker: "TSM",
          relevance_score: "0.98",
          ticker_sentiment_score: "-0.88",
          ticker_sentiment_label: "Bearish",
        },
      ],
    },
  ],
} as const;

export const alphaVantageMarketNews: AlphaVantageMarketNewsResponse =
  AlphaVantageMarketNewsResponseSchema.parse(raw);
