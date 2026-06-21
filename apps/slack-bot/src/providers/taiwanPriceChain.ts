import type { Market } from '@schemas/zod'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'
import { AllProvidersFailedError } from './failureBoundary.js'

/**
 * Taiwan EOD price provider with automatic failover. Tries the primary (FinMind) first; on ANY
 * thrown error (HTTP 429 / auth_failed / 5xx / network) it falls through to each fallback in order
 * (TWSE → TPEX). Conforms to `ProviderAdapter`, so callers are unaware of the failover.
 *
 * News has no price-source fallback — only the primary (FinMind) serves Taiwan news — so
 * `fetchNews` delegates straight to the primary.
 */
export class TaiwanPriceProviderChain implements ProviderAdapter {
  constructor(
    private readonly primary: ProviderAdapter,
    private readonly fallbacks: ProviderAdapter[]
  ) {}

  async fetchNews(market: Market): Promise<NormalizedNewsItem[]> {
    return this.primary.fetchNews(market)
  }

  async fetchMarketSnapshot(symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    const providers = [this.primary, ...this.fallbacks]
    const errors: string[] = []
    for (const provider of providers) {
      try {
        return await provider.fetchMarketSnapshot(symbols)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err))
      }
    }
    throw new AllProvidersFailedError(
      `All Taiwan price providers failed: ${errors.join('; ')}`
    )
  }
}
