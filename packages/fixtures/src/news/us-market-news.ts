import { type NewsArticle } from "../schemas/news-article.schema.js";

export const usMarketNewsArticle: NewsArticle = {
  id: "news-us-market-001",
  title: "S&P 500 Gains as Fed Signals Potential Rate Cuts in 2024",
  source: "Financial Times",
  publishedAt: "2024-01-15T18:30:00.000Z",
  body: "U.S. equity markets advanced on Monday after Federal Reserve officials signaled a willingness to consider interest rate cuts later in 2024, provided inflation continues its downward trajectory. The S&P 500 rose 0.9%, the Nasdaq Composite gained 1.2%, and the Dow Jones Industrial Average added 0.6%. VOO, the Vanguard S&P 500 ETF, saw elevated trading volume as investors repositioned portfolios in anticipation of a more accommodative monetary policy environment. Treasury yields fell across the curve, with the 10-year note dropping to 3.95%.",
  relevanceScore: 0.89,
  confidence: 0.91,
  url: "https://example-ft.com/articles/sp500-fed-rate-cuts-2024-01-15",
  tickers: ["VOO", "QQQ", "SPY"],
  tags: ["us-market", "federal-reserve", "rate-cuts", "s&p500"],
  language: "en",
};
