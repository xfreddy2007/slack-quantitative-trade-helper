import type { Market } from '@schemas/zod'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'

// TODO: T6.1.1
export class AlphaVantageStub implements ProviderAdapter {
  async fetchNews(_market: Market): Promise<NormalizedNewsItem[]> {
    return []
  }

  async fetchMarketSnapshot(_symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    return []
  }
}
