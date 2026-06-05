import type { NewsFixture, PriceSnapshotFixture, Market } from '@schemas/zod'

export type NormalizedNewsItem = NewsFixture
export type NormalizedPriceSnapshot = PriceSnapshotFixture

export interface ProviderAdapter {
  fetchNews(market: Market): Promise<NormalizedNewsItem[]>
  fetchMarketSnapshot(symbols: string[]): Promise<NormalizedPriceSnapshot[]>
}
