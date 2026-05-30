import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'
import { PortfolioFixtureSchema } from '@schemas/zod/portfolio-fixture'
import { PriceSnapshotFixtureSchema } from '@schemas/zod/price-snapshot-fixture'
import { NewsFixtureSchema } from '@schemas/zod/news-fixture'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, '../../../../packages/fixtures')

function loadJSON(relPath: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, relPath), 'utf-8'))
}

// ─── Portfolio fixtures ────────────────────────────────────────────────────────

describe('Portfolio fixtures', () => {
  const portfolioFiles = [
    { file: 'portfolios/tw-etf.json', label: 'tw-etf' },
    { file: 'portfolios/us-etf.json', label: 'us-etf' },
    { file: 'portfolios/mixed.json', label: 'mixed' },
  ]

  it.each(portfolioFiles)('$label validates against PortfolioFixtureSchema', ({ file }) => {
    const data = loadJSON(file)
    expect(() => PortfolioFixtureSchema.parse(data)).not.toThrow()
  })

  it('tw-etf has only TW holdings', () => {
    const p = PortfolioFixtureSchema.parse(loadJSON('portfolios/tw-etf.json'))
    expect(p.holdings.every((h) => h.market === 'TW')).toBe(true)
  })

  it('us-etf has only US holdings', () => {
    const p = PortfolioFixtureSchema.parse(loadJSON('portfolios/us-etf.json'))
    expect(p.holdings.every((h) => h.market === 'US')).toBe(true)
  })

  it('mixed has at least one TW and one US holding', () => {
    const p = PortfolioFixtureSchema.parse(loadJSON('portfolios/mixed.json'))
    expect(p.holdings.some((h) => h.market === 'TW')).toBe(true)
    expect(p.holdings.some((h) => h.market === 'US')).toBe(true)
  })

  it('mixed all holdings have cost_basis set (not null)', () => {
    const p = PortfolioFixtureSchema.parse(loadJSON('portfolios/mixed.json'))
    expect(p.holdings.every((h) => h.cost_basis != null)).toBe(true)
  })

  it('allocation_targets sum to 100 for each portfolio', () => {
    for (const { file } of portfolioFiles) {
      const p = PortfolioFixtureSchema.parse(loadJSON(file))
      const total = p.allocation_targets.reduce((sum, t) => sum + t.target_pct, 0)
      expect(total).toBe(100)
    }
  })
})

// ─── Price snapshot fixtures ───────────────────────────────────────────────────

describe('Price snapshot fixtures', () => {
  const priceFiles = [
    { file: 'prices/voo.json', symbol: 'VOO', market: 'US', currency: 'USD' },
    { file: 'prices/0050-tw.json', symbol: '0050.TW', market: 'TW', currency: 'TWD' },
    { file: 'prices/2330-tw.json', symbol: '2330.TW', market: 'TW', currency: 'TWD' },
    { file: 'prices/cash.json', symbol: 'USD_CASH', market: 'US', currency: 'USD' },
  ]

  it.each(priceFiles)('$symbol validates against PriceSnapshotFixtureSchema', ({ file }) => {
    const data = loadJSON(file)
    expect(() => PriceSnapshotFixtureSchema.parse(data)).not.toThrow()
  })

  it.each(priceFiles)('$symbol has required fields', ({ file, symbol, market, currency }) => {
    const p = PriceSnapshotFixtureSchema.parse(loadJSON(file))
    expect(p.symbol).toBe(symbol)
    expect(p.market).toBe(market)
    expect(p.currency).toBe(currency)
    expect(typeof p.price).toBe('number')
    expect(p.price).toBeGreaterThan(0)
    expect(p.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ─── News fixtures ─────────────────────────────────────────────────────────────

describe('News fixtures', () => {
  const newsFiles = [
    { file: 'news/tw-market-news.json', market: 'TW', label: 'tw-market-news' },
    { file: 'news/us-market-news.json', market: 'US', label: 'us-market-news' },
    { file: 'news/geopolitical-shock.json', market: 'GLOBAL', label: 'geopolitical-shock' },
    { file: 'news/low-confidence-noise.json', market: 'US', label: 'low-confidence-noise' },
    { file: 'news/duplicate-a.json', market: 'TW', label: 'duplicate-a' },
    { file: 'news/duplicate-b.json', market: 'TW', label: 'duplicate-b' },
  ]

  it.each(newsFiles)('$label validates against NewsFixtureSchema', ({ file }) => {
    const data = loadJSON(file)
    expect(() => NewsFixtureSchema.parse(data)).not.toThrow()
  })

  it.each(newsFiles)('$label has required fields', ({ file, market }) => {
    const n = NewsFixtureSchema.parse(loadJSON(file))
    expect(n.title).toBeTruthy()
    expect(n.source_url).toMatch(/^https?:\/\//)
    expect(n.market).toBe(market)
    expect(n.published_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(n.content).toBeTruthy()
  })

  it('geopolitical-shock has severity 5', () => {
    const n = NewsFixtureSchema.parse(loadJSON('news/geopolitical-shock.json'))
    expect(n.expected_severity).toBe(5)
  })

  it('low-confidence-noise has confidence 1', () => {
    const n = NewsFixtureSchema.parse(loadJSON('news/low-confidence-noise.json'))
    expect(n.expected_confidence).toBe(1)
  })

  it('duplicate pair has identical title and content but different URLs', () => {
    const a = NewsFixtureSchema.parse(loadJSON('news/duplicate-a.json'))
    const b = NewsFixtureSchema.parse(loadJSON('news/duplicate-b.json'))
    expect(a.title).toBe(b.title)
    expect(a.content).toBe(b.content)
    expect(a.source_url).not.toBe(b.source_url)
  })
})

// ─── Provider payload fixtures ─────────────────────────────────────────────────

const AlphaVantageNewsSchema = z.object({
  items: z.string(),
  feed: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      time_published: z.string(),
      overall_sentiment_score: z.number(),
      ticker_sentiment: z.array(
        z.object({
          ticker: z.string(),
          relevance_score: z.string(),
        })
      ),
    })
  ),
})

const TwinkleHubContextSchema = z.object({
  tool: z.string(),
  query: z.record(z.string()),
  result: z.record(z.unknown()),
})

describe('Provider payload fixtures', () => {
  it('alpha-vantage-news validates basic contract', () => {
    const data = loadJSON('provider-payloads/alpha-vantage-news.json')
    expect(() => AlphaVantageNewsSchema.parse(data)).not.toThrow()
  })

  it('alpha-vantage-news feed has at least one item with ticker_sentiment', () => {
    const p = AlphaVantageNewsSchema.parse(
      loadJSON('provider-payloads/alpha-vantage-news.json')
    )
    expect(p.feed.length).toBeGreaterThan(0)
    expect(p.feed[0].ticker_sentiment.length).toBeGreaterThan(0)
  })

  it('twinkle-hub-context validates basic contract', () => {
    const data = loadJSON('provider-payloads/twinkle-hub-context.json')
    expect(() => TwinkleHubContextSchema.parse(data)).not.toThrow()
  })

  it('twinkle-hub-context result contains company data', () => {
    const p = TwinkleHubContextSchema.parse(
      loadJSON('provider-payloads/twinkle-hub-context.json')
    )
    expect(p.result['stock_symbol']).toBeTruthy()
    expect(p.result['company_name']).toBeTruthy()
  })
})
