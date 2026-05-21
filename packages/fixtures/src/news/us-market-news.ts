import { NewsArticleSchema, type NewsArticle } from "../schemas/index.ts";

const raw = {
  id: "b2c3d4e5-0002-4000-8000-100000000002",
  title: "S&P 500 Closes at Record High Amid Strong Jobs Data",
  url: "https://example-news.com/sp500-record-jobs-2024-06-01",
  summary:
    "The S&P 500 index closed at an all-time high on Friday after the U.S. Labor Department reported stronger-than-expected non-farm payrolls. The index gained 0.73%, with the technology and consumer discretionary sectors leading gains. VOO, the Vanguard S&P 500 ETF, rose in tandem.",
  source: "Market Watch Daily",
  authors: ["Sarah Johnson"],
  publishedAt: "2024-06-01T21:30:00.000+00:00",
  overallSentiment: "Bullish",
  overallSentimentScore: 0.68,
  confidenceScore: 0.91,
  impact: "MEDIUM",
  relatedMarkets: ["US"],
  tickerSentiments: [
    {
      ticker: "VOO",
      relevanceScore: 0.88,
      tickerSentimentScore: 0.7,
      tickerSentimentLabel: "Bullish",
    },
    {
      ticker: "QQQ",
      relevanceScore: 0.75,
      tickerSentimentScore: 0.62,
      tickerSentimentLabel: "Bullish",
    },
  ],
  tags: ["us", "sp500", "jobs-report", "record-high"],
} as const;

export const usMarketNews: NewsArticle = NewsArticleSchema.parse(raw);
