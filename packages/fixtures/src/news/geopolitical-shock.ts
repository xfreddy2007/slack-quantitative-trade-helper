import { type NewsArticle } from "../schemas/news-article.schema.js";

export const geopoliticalShockArticle: NewsArticle = {
  id: "news-geopolitical-001",
  title: "Taiwan Strait Tensions Escalate: Markets Brace for Volatility",
  source: "Reuters",
  publishedAt: "2024-01-15T06:00:00.000Z",
  body: "Geopolitical tensions in the Taiwan Strait intensified on Monday following a series of military exercises by regional powers, sending shockwaves through Asian financial markets. The TAIEX fell 3.2% in early trading before partially recovering, while the Taiwan dollar weakened against the U.S. dollar. TSMC shares dropped 4.1% amid concerns over supply chain disruptions. Global semiconductor stocks also declined in sympathy, with the Philadelphia Semiconductor Index futures pointing to a 2.5% lower open. Risk-off sentiment dominated, with investors fleeing to safe-haven assets including gold and U.S. Treasuries. Analysts warn that a prolonged escalation could have significant implications for global technology supply chains.",
  relevanceScore: 0.98,
  confidence: 0.95,
  url: "https://example-reuters.com/articles/taiwan-strait-tensions-2024-01-15",
  tickers: ["2330.TW", "0050.TW", "SOXX", "TSM"],
  tags: ["geopolitical", "taiwan-strait", "high-impact", "volatility", "risk-off"],
  language: "en",
};
