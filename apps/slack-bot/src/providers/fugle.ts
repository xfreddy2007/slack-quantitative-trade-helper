import type { Market } from '@schemas/zod'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'

// TODO: real-time upgrade — Fugle provides intraday/real-time Taiwan quotes. This placeholder
// keeps the ProviderAdapter surface in place without making any HTTP calls until that work lands.
export class FugleStub implements ProviderAdapter {
  async fetchNews(_market: Market): Promise<NormalizedNewsItem[]> {
    return []
  }

  async fetchMarketSnapshot(_symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    return []
  }
}
