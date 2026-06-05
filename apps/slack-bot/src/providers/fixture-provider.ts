import type { Market } from '@schemas/zod'
import { loadNewsFixtures, loadPriceFixtures } from '../fixtures/loader.js'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'

export class FixtureProvider implements ProviderAdapter {
  async fetchNews(market: Market): Promise<NormalizedNewsItem[]> {
    return loadNewsFixtures().filter((n) => n.market === market)
  }

  async fetchMarketSnapshot(symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    const all = loadPriceFixtures()
    if (symbols.length === 0) return all
    return all.filter((p) => symbols.includes(p.symbol))
  }
}
