import { describe, it, expect } from 'vitest'
import { FixtureProvider, AlphaVantageStub, TwinkleHubStub } from '../../src/providers/index.js'

describe('FixtureProvider', () => {
  const provider = new FixtureProvider()

  describe('fetchNews', () => {
    it('returns at least one TW news item for market TW', async () => {
      const news = await provider.fetchNews('TW')
      expect(news.length).toBeGreaterThanOrEqual(1)
      expect(news.every((n) => n.market === 'TW')).toBe(true)
    })

    it('returns at least one US news item for market US', async () => {
      const news = await provider.fetchNews('US')
      expect(news.length).toBeGreaterThanOrEqual(1)
      expect(news.every((n) => n.market === 'US')).toBe(true)
    })

    it('returns only GLOBAL news items for market GLOBAL', async () => {
      const news = await provider.fetchNews('GLOBAL')
      expect(news.length).toBeGreaterThanOrEqual(1)
      expect(news.every((n) => n.market === 'GLOBAL')).toBe(true)
    })

    it('each TW news item has required fields', async () => {
      const news = await provider.fetchNews('TW')
      for (const n of news) {
        expect(typeof n.title).toBe('string')
        expect(n.title.length).toBeGreaterThan(0)
        expect(n.source_url).toMatch(/^https?:\/\//)
        expect(n.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(typeof n.content).toBe('string')
      }
    })
  })

  describe('fetchMarketSnapshot', () => {
    it('returns all price fixtures when symbols is empty', async () => {
      const prices = await provider.fetchMarketSnapshot([])
      expect(prices.length).toBeGreaterThanOrEqual(4)
    })

    it('filters to matching symbols', async () => {
      const prices = await provider.fetchMarketSnapshot(['VOO'])
      expect(prices).toHaveLength(1)
      expect(prices[0].symbol).toBe('VOO')
    })

    it('returns multiple symbols when requested', async () => {
      const prices = await provider.fetchMarketSnapshot(['VOO', '0050.TW'])
      expect(prices).toHaveLength(2)
      const symbols = prices.map((p) => p.symbol)
      expect(symbols).toContain('VOO')
      expect(symbols).toContain('0050.TW')
    })

    it('returns empty array for unknown symbol', async () => {
      const prices = await provider.fetchMarketSnapshot(['UNKNOWN_SYMBOL'])
      expect(prices).toHaveLength(0)
    })

    it('each price snapshot has required fields', async () => {
      const prices = await provider.fetchMarketSnapshot(['VOO'])
      expect(prices[0].price).toBeGreaterThan(0)
      expect(typeof prices[0].currency).toBe('string')
      expect(prices[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(typeof prices[0].symbol).toBe('string')
    })
  })
})

describe('AlphaVantageStub', () => {
  const stub = new AlphaVantageStub()

  it('fetchNews returns empty array', async () => {
    const result = await stub.fetchNews('TW')
    expect(result).toEqual([])
  })

  it('fetchMarketSnapshot returns empty array', async () => {
    const result = await stub.fetchMarketSnapshot(['VOO'])
    expect(result).toEqual([])
  })
})

describe('TwinkleHubStub', () => {
  const stub = new TwinkleHubStub()

  it('fetchNews returns empty array', async () => {
    const result = await stub.fetchNews('US')
    expect(result).toEqual([])
  })

  it('fetchMarketSnapshot returns empty array', async () => {
    const result = await stub.fetchMarketSnapshot(['0050.TW'])
    expect(result).toEqual([])
  })
})
