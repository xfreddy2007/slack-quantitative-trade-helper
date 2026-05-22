import { type NewsArticle } from "../schemas/news-article.schema.js";

export const lowConfidenceNoisyArticle: NewsArticle = {
  id: "news-noisy-001",
  title: "Local Restaurant Chain Expands to Third Location in Taipei",
  source: "Taipei Lifestyle Blog",
  publishedAt: "2024-01-15T10:00:00.000Z",
  body: "A popular bubble tea chain announced the opening of its third location in the Da'an District of Taipei. The new store features an expanded menu with seasonal fruit teas and a loyalty rewards program. The owner cited strong consumer demand and favorable lease terms as key factors in the expansion decision. The opening is scheduled for next weekend and will feature a promotional discount for the first 100 customers.",
  relevanceScore: 0.04,
  confidence: 0.11,
  url: "https://example-taipei-lifestyle.com/articles/bubble-tea-expansion-2024-01-15",
  tickers: [],
  tags: ["lifestyle", "food", "taipei", "irrelevant"],
  language: "en",
};
