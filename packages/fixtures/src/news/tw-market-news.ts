import { NewsArticleSchema, type NewsArticle } from "../schemas/index.ts";

const raw = {
  id: "b2c3d4e5-0001-4000-8000-100000000001",
  title: "Taiwan Stock Exchange Hits 3-Month High as Tech Sector Rallies",
  url: "https://example-news.com/tw-market-rally-2024-06-03",
  summary:
    "The Taiwan Stock Exchange Capitalization Weighted Stock Index (TAIEX) climbed 1.4% on Monday, driven by strong gains in semiconductor and electronics stocks. TSMC led the advance, rising 1.5% to NT$820, while the broader tech sector added 2.1%.",
  source: "Taiwan Financial Times",
  authors: ["Chen Wei-Lin", "Liu Mei-Hua"],
  publishedAt: "2024-06-03T10:15:00.000+08:00",
  overallSentiment: "Bullish",
  overallSentimentScore: 0.72,
  confidenceScore: 0.88,
  impact: "MEDIUM",
  relatedMarkets: ["TW"],
  tickerSentiments: [
    {
      ticker: "2330.TW",
      relevanceScore: 0.95,
      tickerSentimentScore: 0.78,
      tickerSentimentLabel: "Bullish",
    },
    {
      ticker: "0050.TW",
      relevanceScore: 0.82,
      tickerSentimentScore: 0.65,
      tickerSentimentLabel: "Bullish",
    },
  ],
  tags: ["taiwan", "taiex", "semiconductor", "rally"],
} as const;

export const twMarketNews: NewsArticle = NewsArticleSchema.parse(raw);
