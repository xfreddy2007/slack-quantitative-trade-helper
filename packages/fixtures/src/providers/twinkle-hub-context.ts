import { type TwinkleHubContext } from "../schemas/twinkle-hub.schema.js";

export const twinkleHubContextPayload: TwinkleHubContext = {
  requestId: "twh-req-20240115-001",
  generatedAt: "2024-01-15T21:30:00.000Z",
  marketContext: {
    region: "APAC+US",
    marketStatus: "closed",
    tradingDate: "2024-01-15T00:00:00.000Z",
    indices: [
      {
        name: "TAIEX",
        value: 17_432.5,
        change: 142.3,
        changePercent: 0.82,
      },
      {
        name: "S&P 500",
        value: 4_783.45,
        change: 42.61,
        changePercent: 0.9,
      },
      {
        name: "NASDAQ",
        value: 14_972.76,
        change: 178.34,
        changePercent: 1.21,
      },
    ],
  },
  sentimentSignals: [
    {
      ticker: "2330.TW",
      signal: "buy",
      score: 0.62,
      confidence: 0.87,
      generatedAt: "2024-01-15T21:00:00.000Z",
      sources: ["alpha-vantage-news", "twinkle-hub-proprietary", "earnings-report"],
    },
    {
      ticker: "0050.TW",
      signal: "neutral",
      score: 0.08,
      confidence: 0.72,
      generatedAt: "2024-01-15T21:00:00.000Z",
      sources: ["alpha-vantage-news", "twinkle-hub-proprietary"],
    },
    {
      ticker: "VOO",
      signal: "buy",
      score: 0.45,
      confidence: 0.81,
      generatedAt: "2024-01-15T21:00:00.000Z",
      sources: ["alpha-vantage-news", "fed-signals", "twinkle-hub-proprietary"],
    },
  ],
  metadata: {
    version: "1.0.0",
    provider: "twinkle-hub",
    latencyMs: 234,
  },
};
