import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  AlphaVantageAdapter,
  parseAlphaVantagePayload,
  type AlphaVantagePayload,
} from '../../src/providers/alpha-vantage.js'
import { NewsFixtureSchema } from '@schemas/zod/news-fixture'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = resolve(__dirname, '../../../../packages/fixtures')

function loadPayload(): AlphaVantagePayload {
  return JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, 'provider-payloads/alpha-vantage-news.json'), 'utf-8')
  ) as AlphaVantagePayload
}

describe('parseAlphaVantagePayload', () => {
  it('produces 2 records from fixture for US market', () => {
    const result = parseAlphaVantagePayload(loadPayload(), 'US')
    expect(result).toHaveLength(2)
  })

  it('first record has correct field values', () => {
    const [first] = parseAlphaVantagePayload(loadPayload(), 'US')
    expect(first.title).toBe('TSMC Reports Record Q1 Earnings Amid AI Chip Demand')
    expect(first.source_url).toBe('https://example.com/tsmc-q1-2026')
    expect(first.published_at).toBe('2026-05-29T08:30:00Z')
    expect(first.market).toBe('US')
    expect(first.content).toBe(
      'TSMC Q1 2026 earnings exceeded analyst expectations driven by AI chip demand from hyperscalers.'
    )
    expect(first.expected_tags).toEqual(['TSM'])
    expect(first.author).toBe('Financial Times')
    expect(first.provider).toBe('alpha-vantage')
  })

  it('second record has correct tickers and timestamp', () => {
    const [, second] = parseAlphaVantagePayload(loadPayload(), 'US')
    expect(second.expected_tags).toEqual(['VOO'])
    expect(second.published_at).toBe('2026-05-29T12:00:00Z')
  })

  it('all records validate against NewsFixtureSchema', () => {
    const result = parseAlphaVantagePayload(loadPayload(), 'US')
    for (const item of result) {
      expect(() => NewsFixtureSchema.parse(item)).not.toThrow()
    }
  })

  it('returns empty array for TW market', () => {
    expect(parseAlphaVantagePayload(loadPayload(), 'TW')).toHaveLength(0)
  })

  it('returns empty array for GLOBAL market', () => {
    expect(parseAlphaVantagePayload(loadPayload(), 'GLOBAL')).toHaveLength(0)
  })
})

describe('AlphaVantageAdapter.fetchNews', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('US market: checks rate limit then parses fetched payload', async () => {
    const guard = { check: vi.fn() }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => loadPayload(),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new AlphaVantageAdapter('test-key', guard as never)
    const result = await adapter.fetchNews('US')

    expect(guard.check).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(result).toHaveLength(2)
  })

  it('non-US market: short-circuits without touching guard or network', async () => {
    const guard = { check: vi.fn() }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new AlphaVantageAdapter('test-key', guard as never)
    const result = await adapter.fetchNews('TW')

    expect(result).toEqual([])
    expect(guard.check).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the API responds with a non-ok status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new AlphaVantageAdapter('test-key')
    await expect(adapter.fetchNews('US')).rejects.toThrow('429')
  })

  it('surfaces the throttle message when AV returns 200 OK with no feed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Information: 'Thank you for using Alpha Vantage! ... call frequency ...' }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new AlphaVantageAdapter('test-key')
    await expect(adapter.fetchNews('US')).rejects.toThrow('call frequency')
  })
})

describe('parseAlphaVantagePayload — missing feed', () => {
  it('returns empty array when payload has no feed key', () => {
    expect(parseAlphaVantagePayload({} as AlphaVantagePayload, 'US')).toEqual([])
  })
})
