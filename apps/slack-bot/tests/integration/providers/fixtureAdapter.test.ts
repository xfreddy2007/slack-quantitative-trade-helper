import { describe, it, expect } from 'vitest'
import { FixtureProvider } from '../../../src/providers/fixture-provider.js'

describe('FixtureProvider — adapter contract', () => {
  it('fetchMarketSnapshot returns normalized records with symbol, provider, and timestamp', async () => {
    const provider = new FixtureProvider()
    const snapshots = await provider.fetchMarketSnapshot([])

    expect(snapshots.length).toBeGreaterThan(0)
    for (const snapshot of snapshots) {
      expect(snapshot).toHaveProperty('symbol')
      expect(snapshot).toHaveProperty('provider')
      expect(snapshot).toHaveProperty('timestamp')
    }
  })

  it('fetchNews returns normalized records filtered by market', async () => {
    const provider = new FixtureProvider()
    const news = await provider.fetchNews('TW')

    expect(news.length).toBeGreaterThan(0)
    for (const item of news) {
      expect(item.market).toBe('TW')
      expect(item).toHaveProperty('title')
      expect(item).toHaveProperty('source_url')
      expect(item).toHaveProperty('published_at')
    }
  })
})
