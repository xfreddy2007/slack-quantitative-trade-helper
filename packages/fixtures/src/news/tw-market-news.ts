import { type NewsArticle } from "../schemas/news-article.schema.js";

export const twMarketNewsArticle: NewsArticle = {
  id: "news-tw-market-001",
  title: "Taiwan Stock Exchange Hits Record High Amid Semiconductor Surge",
  source: "Taiwan Economic Daily",
  publishedAt: "2024-01-15T03:00:00.000Z",
  body: "The Taiwan Stock Exchange Capitalization Weighted Stock Index (TAIEX) reached a new record high on Monday, driven by strong gains in semiconductor stocks. TSMC led the rally with a 2.3% gain, while the broader technology sector added 1.8%. Analysts attribute the surge to robust demand for AI-related chips and positive earnings guidance from major chipmakers. Foreign institutional investors were net buyers for the third consecutive session, purchasing NT$12.4 billion worth of shares.",
  relevanceScore: 0.92,
  confidence: 0.88,
  url: "https://example-ted.com/articles/taiex-record-high-2024-01-15",
  tickers: ["0050.TW", "2330.TW", "2303.TW"],
  tags: ["taiwan", "semiconductor", "taiex", "record-high"],
  language: "en",
};
