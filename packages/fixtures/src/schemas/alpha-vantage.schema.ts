import { z } from "zod";

export const alphaVantageTickerSentimentSchema = z.object({
  ticker: z.string().min(1),
  relevance_score: z.string(),
  ticker_sentiment_score: z.string(),
  ticker_sentiment_label: z.enum([
    "Bearish",
    "Somewhat-Bearish",
    "Neutral",
    "Somewhat-Bullish",
    "Bullish",
  ]),
});

export const alphaVantageTopicSchema = z.object({
  topic: z.string().min(1),
  relevance_score: z.string(),
});

export const alphaVantageFeedItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  time_published: z.string().min(1),
  authors: z.array(z.string()),
  summary: z.string(),
  banner_image: z.string().nullable(),
  source: z.string().min(1),
  category_within_source: z.string(),
  source_domain: z.string(),
  topics: z.array(alphaVantageTopicSchema),
  overall_sentiment_score: z.number(),
  overall_sentiment_label: z.enum([
    "Bearish",
    "Somewhat-Bearish",
    "Neutral",
    "Somewhat-Bullish",
    "Bullish",
  ]),
  ticker_sentiment: z.array(alphaVantageTickerSentimentSchema),
});

export const alphaVantageNewsSentimentSchema = z.object({
  items: z.string(),
  sentiment_score_definition: z.string(),
  relevance_score_definition: z.string(),
  feed: z.array(alphaVantageFeedItemSchema),
});

export type AlphaVantageTickerSentiment = z.infer<typeof alphaVantageTickerSentimentSchema>;
export type AlphaVantageTopicItem = z.infer<typeof alphaVantageTopicSchema>;
export type AlphaVantageFeedItem = z.infer<typeof alphaVantageFeedItemSchema>;
export type AlphaVantageNewsSentiment = z.infer<typeof alphaVantageNewsSentimentSchema>;
