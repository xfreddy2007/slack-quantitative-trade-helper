import type { Market } from '@schemas/zod'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'
import type { RateLimitGuard } from './rate-limit-guard.js'

type AvTickerSentiment = {
  ticker: string
  relevance_score: string
  ticker_sentiment_score: string
  ticker_sentiment_label: string
}

type AvFeedItem = {
  title: string
  url: string
  time_published: string
  authors: string[]
  summary: string
  source: string
  overall_sentiment_score: number
  overall_sentiment_label: string
  ticker_sentiment: AvTickerSentiment[]
}

export type AlphaVantagePayload = {
  items?: string
  feed?: AvFeedItem[]
  // Alpha Vantage returns HTTP 200 with one of these (and no `feed`) on throttle/bad params.
  Information?: string
  ['Error Message']?: string
}

// "20260529T083000" → "2026-05-29T08:30:00Z"
function parseAvTime(t: string): string {
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}Z`
}

export function parseAlphaVantagePayload(
  payload: AlphaVantagePayload,
  market: Market
): NormalizedNewsItem[] {
  if (market !== 'US') return []
  return (payload.feed ?? []).map((item): NormalizedNewsItem => ({
    title: item.title,
    source_url: item.url,
    market,
    published_at: parseAvTime(item.time_published),
    content: item.summary,
    // NewsFixture has no dedicated ticker field; the article's mentioned tickers are carried
    // in expected_tags by design for T6.1.1 (asserted by the contract test).
    expected_tags: item.ticker_sentiment.map((t) => t.ticker),
    author: item.source,
    provider: 'alpha-vantage',
  }))
}

export class AlphaVantageAdapter implements ProviderAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly rateLimitGuard?: RateLimitGuard
  ) {}

  async fetchNews(market: Market): Promise<NormalizedNewsItem[]> {
    // Alpha Vantage News & Sentiment is US-only; short-circuit before spending a
    // rate-limit token or making a live request for markets it cannot serve.
    if (market !== 'US') return []
    this.rateLimitGuard?.check()
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&sort=LATEST&limit=50&apikey=${this.apiKey}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Alpha Vantage API error: ${res.status}`)
    const payload = (await res.json()) as AlphaVantagePayload
    // AV signals throttle/errors as HTTP 200 with no `feed`; surface the message instead of
    // returning an empty list that masks a quota problem.
    if (!Array.isArray(payload.feed)) {
      const reason = payload.Information ?? payload['Error Message'] ?? 'no feed in response'
      throw new Error(`Alpha Vantage returned no feed: ${reason}`)
    }
    return parseAlphaVantagePayload(payload, market)
  }

  async fetchMarketSnapshot(_symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    return []
  }
}
