export type Market = 'TW' | 'US' | 'GLOBAL'

export interface NewsFixture {
  title: string
  source_url: string
  market: Market
  published_at: string
  content: string
  expected_tags?: string[]
  expected_severity?: number
  expected_confidence?: number
  author?: string
  provider?: string
}

export interface PriceSnapshotFixture {
  symbol: string
  market: Market
  price: number
  currency: string
  timestamp: string
  provider: string
  volume?: number
  change_pct?: number
}
