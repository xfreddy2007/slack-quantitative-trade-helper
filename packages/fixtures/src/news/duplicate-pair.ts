import { type NewsArticle } from "../schemas/news-article.schema.js";

export const duplicateArticleA: NewsArticle = {
  id: "news-dup-001a",
  title: "TSMC Reports Strong Q4 Earnings, Beats Analyst Estimates",
  source: "Bloomberg",
  publishedAt: "2024-01-15T12:00:00.000Z",
  body: "Taiwan Semiconductor Manufacturing Company reported fourth-quarter earnings that exceeded analyst expectations, with revenue of NT$625.5 billion and net income of NT$238.7 billion. The company cited strong demand for its advanced 3nm and 5nm process nodes, driven by AI accelerator chips. TSMC raised its full-year 2024 revenue guidance, projecting growth of 20-25% in U.S. dollar terms. The results sent TSMC shares up 3.5% in Taipei trading.",
  relevanceScore: 0.96,
  confidence: 0.94,
  url: "https://example-bloomberg.com/articles/tsmc-q4-earnings-2024-01-15",
  tickers: ["2330.TW", "TSM"],
  tags: ["tsmc", "earnings", "semiconductor", "q4-2024"],
  language: "en",
};

export const duplicateArticleB: NewsArticle = {
  id: "news-dup-001b",
  title: "TSMC Q4 Results Beat Expectations on AI Chip Demand",
  source: "Wall Street Journal",
  publishedAt: "2024-01-15T12:45:00.000Z",
  body: "Taiwan Semiconductor Manufacturing Co. posted fourth-quarter results that surpassed Wall Street forecasts, with quarterly revenue reaching NT$625.5 billion and profit of NT$238.7 billion. The chipmaker pointed to surging demand for its cutting-edge 3-nanometer and 5-nanometer chips used in artificial intelligence applications. Management lifted its 2024 annual revenue outlook, forecasting a 20% to 25% increase in dollar terms. Shares of TSMC climbed 3.5% on the Taiwan Stock Exchange following the announcement.",
  relevanceScore: 0.95,
  confidence: 0.93,
  url: "https://example-wsj.com/articles/tsmc-q4-beats-ai-demand-2024-01-15",
  tickers: ["2330.TW", "TSM"],
  tags: ["tsmc", "earnings", "semiconductor", "q4-2024"],
  language: "en",
};
