import {
  TwinkleHubContextResponseSchema,
  type TwinkleHubContextResponse,
} from "../schemas/index.ts";

// TODO: align with provider adapter spec once Twinkle Hub adapter is finalised
const raw = {
  requestId: "c3d4e5f6-0001-4000-8000-200000000001",
  generatedAt: "2024-06-03T12:00:00.000+00:00",
  model: "twinkle-hub-v1.2",
  context: {
    portfolioId: "a1b2c3d4-0003-4000-8000-000000000003",
    summary:
      "The mixed ETF and stock portfolio is moderately exposed to Taiwan geopolitical risk via TSMC and 0050.TW. Recent escalation in the Taiwan Strait warrants a review of position sizing.",
    riskLevel: "HIGH",
    recommendations: [
      {
        ticker: "2330.TW",
        action: "REDUCE",
        rationale:
          "Geopolitical risk premium has increased materially. Consider reducing TSMC exposure by 10–15% until tensions de-escalate.",
        confidence: 0.78,
      },
      {
        ticker: "VOO",
        action: "HOLD",
        rationale:
          "U.S. equities remain resilient. No action required at this time.",
        confidence: 0.85,
      },
      {
        ticker: "CASH",
        action: "INCREASE",
        rationale:
          "Raise cash buffer to absorb potential volatility from Taiwan Strait developments.",
        confidence: 0.72,
      },
    ],
    marketOutlook:
      "Near-term outlook is cautious for Taiwan-exposed assets. U.S. markets remain supported by strong macro data. Monitor Taiwan Strait developments closely.",
    dataSourcesUsed: [
      "alpha-vantage-market-news",
      "tw-market-news",
      "geopolitical-shock",
    ],
  },
  metadata: {
    latencyMs: 1240,
    tokensUsed: 3850,
    version: "1.2.0",
  },
} as const;

export const twinkleHubContext: TwinkleHubContextResponse =
  TwinkleHubContextResponseSchema.parse(raw);
