// ── Schemas ──────────────────────────────────────────────────────────────────
export {
  portfolioSchema,
  holdingSchema,
  holdingTypeSchema,
  type Portfolio,
  type Holding,
  type HoldingType,
} from "./schemas/portfolio.schema.js";

export {
  priceSnapshotSchema,
  type PriceSnapshot,
} from "./schemas/price-snapshot.schema.js";

export {
  newsArticleSchema,
  type NewsArticle,
} from "./schemas/news-article.schema.js";

export {
  alphaVantageNewsSentimentSchema,
  alphaVantageFeedItemSchema,
  alphaVantageTickerSentimentSchema,
  alphaVantageTopicSchema,
  type AlphaVantageNewsSentiment,
  type AlphaVantageFeedItem,
  type AlphaVantageTickerSentiment,
  type AlphaVantageTopicItem,
} from "./schemas/alpha-vantage.schema.js";

export {
  twinkleHubContextSchema,
  twinkleHubMarketContextSchema,
  twinkleHubSentimentSignalSchema,
  type TwinkleHubContext,
  type TwinkleHubMarketContext,
  type TwinkleHubSentimentSignal,
} from "./schemas/twinkle-hub.schema.js";

// ── Portfolio Fixtures ────────────────────────────────────────────────────────
export { taiwanEtfOnlyPortfolio } from "./portfolios/taiwan-etf-only.js";
export { usEtfOnlyPortfolio } from "./portfolios/us-etf-only.js";
export { mixedEtfStockPortfolio } from "./portfolios/mixed-etf-stock.js";

// ── Price Snapshot Fixtures ───────────────────────────────────────────────────
export { vooSnapshot } from "./prices/voo-snapshot.js";
export { tw0050Snapshot } from "./prices/0050-tw-snapshot.js";
export { tw2330Snapshot } from "./prices/2330-tw-snapshot.js";
export { cashPlaceholderSnapshot } from "./prices/cash-placeholder.js";

// ── News Article Fixtures ─────────────────────────────────────────────────────
export { twMarketNewsArticle } from "./news/tw-market-news.js";
export { usMarketNewsArticle } from "./news/us-market-news.js";
export { geopoliticalShockArticle } from "./news/geopolitical-shock.js";
export { lowConfidenceNoisyArticle } from "./news/low-confidence-noisy.js";
export { duplicateArticleA, duplicateArticleB } from "./news/duplicate-pair.js";

// ── Provider Payload Fixtures ─────────────────────────────────────────────────
export { alphaVantageNewsSentimentPayload } from "./providers/alpha-vantage-news-sentiment.js";
export { twinkleHubContextPayload } from "./providers/twinkle-hub-context.js";
