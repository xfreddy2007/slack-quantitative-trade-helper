import { type AlphaVantageNewsSentiment } from "../schemas/alpha-vantage.schema.js";

export const alphaVantageNewsSentimentPayload: AlphaVantageNewsSentiment = {
  items: "2",
  sentiment_score_definition:
    "x <= -0.35: Bearish; -0.35 < x <= -0.15: Somewhat-Bearish; -0.15 < x < 0.15: Neutral; 0.15 <= x < 0.35: Somewhat-Bullish; x >= 0.35: Bullish",
  relevance_score_definition:
    "0 < x <= 1, with a higher score indicating higher relevance.",
  feed: [
    {
      title: "TSMC Reports Record Revenue Driven by AI Chip Demand",
      url: "https://example-alphavantage-source.com/tsmc-record-revenue-2024",
      time_published: "20240115T120000",
      authors: ["Jane Smith", "Bob Chen"],
      summary:
        "TSMC posted record quarterly revenue as demand for AI-related semiconductors surged, with the company's advanced nodes seeing unprecedented order volumes from major hyperscalers.",
      banner_image: "https://example-alphavantage-source.com/images/tsmc-banner.jpg",
      source: "TechFinance Daily",
      category_within_source: "Technology",
      source_domain: "techfinancedaily.com",
      topics: [
        { topic: "Technology", relevance_score: "0.9500" },
        { topic: "Earnings", relevance_score: "0.8800" },
        { topic: "Semiconductor", relevance_score: "0.9800" },
      ],
      overall_sentiment_score: 0.421,
      overall_sentiment_label: "Bullish",
      ticker_sentiment: [
        {
          ticker: "TSM",
          relevance_score: "0.9800",
          ticker_sentiment_score: "0.4350",
          ticker_sentiment_label: "Bullish",
        },
        {
          ticker: "NVDA",
          relevance_score: "0.4200",
          ticker_sentiment_score: "0.2100",
          ticker_sentiment_label: "Somewhat-Bullish",
        },
      ],
    },
    {
      title: "VOO Sees Record Inflows as Investors Bet on Fed Pivot",
      url: "https://example-alphavantage-source.com/voo-inflows-fed-pivot-2024",
      time_published: "20240115T183000",
      authors: ["Alice Johnson"],
      summary:
        "Vanguard's S&P 500 ETF recorded its highest single-day inflows of the year as investors positioned for anticipated Federal Reserve interest rate cuts, pushing the fund's assets under management to a new high.",
      banner_image: null,
      source: "ETF Trends",
      category_within_source: "ETFs",
      source_domain: "etftrends.com",
      topics: [
        { topic: "Finance", relevance_score: "0.9200" },
        { topic: "Federal Reserve", relevance_score: "0.8500" },
        { topic: "ETF", relevance_score: "0.9600" },
      ],
      overall_sentiment_score: 0.312,
      overall_sentiment_label: "Somewhat-Bullish",
      ticker_sentiment: [
        {
          ticker: "VOO",
          relevance_score: "0.9700",
          ticker_sentiment_score: "0.3250",
          ticker_sentiment_label: "Somewhat-Bullish",
        },
        {
          ticker: "SPY",
          relevance_score: "0.6100",
          ticker_sentiment_score: "0.2900",
          ticker_sentiment_label: "Somewhat-Bullish",
        },
      ],
    },
  ],
};
