import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { TwseAdapter, parseTwsePrice, type TwseStockDayRow } from '../../src/providers/twse.js'
import { TpexAdapter, parseTpexPrice, type TpexQuoteRow } from '../../src/providers/tpex.js'
import { FugleStub } from '../../src/providers/fugle.js'
import { TaiwanPriceProviderChain } from '../../src/providers/taiwanPriceChain.js'
import {
  runIsolated,
  AllProvidersFailedError,
  type ProviderRunRecorder,
} from '../../src/providers/failureBoundary.js'
import { RateLimitExceeded } from '../../src/providers/rate-limit-guard.js'
import type {
  ProviderAdapter,
  NormalizedPriceSnapshot,
} from '../../src/providers/adapter.js'
import { PriceSnapshotFixtureSchema } from '@schemas/zod/price-snapshot-fixture'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = resolve(__dirname, '../../../../packages/fixtures')

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, rel), 'utf-8')) as T
}
function okResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response
}
function snapshot(symbol: string, provider: string): NormalizedPriceSnapshot {
  return {
    symbol,
    market: 'TW',
    price: 100,
    currency: 'TWD',
    timestamp: '2026-05-29T05:30:00.000Z',
    provider,
  }
}

describe('twse: parseTwsePrice', () => {
  it('normalizes STOCK_DAY_ALL rows (ClosingPrice → price)', () => {
    const rows = loadJson<TwseStockDayRow[]>('provider-payloads/twse-stock-day.json')
    const result = parseTwsePrice(rows, '2026-05-29T05:30:00.000Z')
    const tw50 = result.find((r) => r.symbol === '0050.TW')!
    expect(tw50.price).toBe(148.5)
    expect(tw50.market).toBe('TW')
    expect(tw50.currency).toBe('TWD')
    expect(tw50.volume).toBe(12500000)
    expect(tw50.provider).toBe('twse')
    for (const snap of result) expect(() => PriceSnapshotFixtureSchema.parse(snap)).not.toThrow()
  })
})

describe('twse: TwseAdapter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('fetches EOD price for 0050.TW from recorded fixture', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(loadJson('provider-payloads/twse-stock-day.json')))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new TwseAdapter().fetchMarketSnapshot(['0050.TW'])
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe('0050.TW')
    expect(result[0].price).toBe(148.5)
    expect(result[0].timestamp).toMatch(/T05:30:00\.000Z$/)
  })

  it('throws on non-ok HTTP so the chain can fall over', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response))
    await expect(new TwseAdapter().fetchMarketSnapshot(['0050.TW'])).rejects.toThrow('500')
  })
})

describe('tpex: parseTpexPrice and TpexAdapter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('converts ROC date and normalizes OTC close', () => {
    const rows = loadJson<TpexQuoteRow[]>('provider-payloads/tpex-daily-quotes.json')
    const result = parseTpexPrice(rows)
    const otc = result.find((r) => r.symbol === '6505.TW')!
    expect(otc.price).toBe(92.3)
    expect(otc.timestamp).toBe('2026-05-29T05:30:00.000Z') // ROC 1150529 → 2026-05-29
    expect(otc.provider).toBe('tpex')
    for (const snap of result) expect(() => PriceSnapshotFixtureSchema.parse(snap)).not.toThrow()
  })

  it('fetches EOD price for OTC stock 6505.TW from recorded fixture', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(loadJson('provider-payloads/tpex-daily-quotes.json')))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new TpexAdapter().fetchMarketSnapshot(['6505.TW'])
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe('6505.TW')
    expect(result[0].price).toBe(92.3)
  })
})

describe('fugle: FugleStub placeholder', () => {
  it('returns empty arrays without any HTTP call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    try {
      const stub = new FugleStub()
      expect(await stub.fetchMarketSnapshot(['0050.TW'])).toEqual([])
      expect(await stub.fetchNews('TW')).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('providerChain: TaiwanPriceProviderChain failover', () => {
  function mockAdapter(impl: Partial<ProviderAdapter>): ProviderAdapter {
    return {
      fetchNews: vi.fn().mockResolvedValue([]),
      fetchMarketSnapshot: vi.fn().mockResolvedValue([]),
      ...impl,
    }
  }

  it('FinMind 429 → returns TWSE fallback response', async () => {
    const finmind = mockAdapter({
      fetchMarketSnapshot: vi.fn().mockRejectedValue(new RateLimitExceeded('FinMind 429')),
    })
    const twse = mockAdapter({
      fetchMarketSnapshot: vi.fn().mockResolvedValue([snapshot('0050.TW', 'twse')]),
    })
    const tpex = mockAdapter({})

    const chain = new TaiwanPriceProviderChain(finmind, [twse, tpex])
    const result = await chain.fetchMarketSnapshot(['0050.TW'])

    expect(result[0].provider).toBe('twse')
    expect(tpex.fetchMarketSnapshot).not.toHaveBeenCalled()
  })

  it('FinMind 429 + TWSE 500 → returns TPEX fallback response', async () => {
    const finmind = mockAdapter({
      fetchMarketSnapshot: vi.fn().mockRejectedValue(new RateLimitExceeded('FinMind 429')),
    })
    const twse = mockAdapter({
      fetchMarketSnapshot: vi.fn().mockRejectedValue(new Error('TWSE API error: 500')),
    })
    const tpex = mockAdapter({
      fetchMarketSnapshot: vi.fn().mockResolvedValue([snapshot('6505.TW', 'tpex')]),
    })

    const chain = new TaiwanPriceProviderChain(finmind, [twse, tpex])
    const result = await chain.fetchMarketSnapshot(['6505.TW'])

    expect(result[0].provider).toBe('tpex')
  })

  it('all providers fail → throws AllProvidersFailedError → runIsolated records all_failed', async () => {
    const fail = (p: string): ProviderAdapter =>
      mockAdapter({ fetchMarketSnapshot: vi.fn().mockRejectedValue(new Error(`${p} down`)) })
    const chain = new TaiwanPriceProviderChain(fail('finmind'), [fail('twse'), fail('tpex')])

    await expect(chain.fetchMarketSnapshot(['0050.TW'])).rejects.toBeInstanceOf(
      AllProvidersFailedError
    )

    const completes: Array<{ status: string }> = []
    const recorder: ProviderRunRecorder = {
      async createProviderRun() {
        return 'run-1'
      },
      async completeProviderRun(_id, opts) {
        completes.push(opts)
      },
    }
    const res = await runIsolated(recorder, 'taiwan-price-chain', [], async () => ({
      data: await chain.fetchMarketSnapshot(['0050.TW']),
    }))

    expect(res.status).toBe('all_failed')
    expect(completes[0].status).toBe('all_failed')
  })

  it('fetchNews delegates to the primary (no price-source fallback)', async () => {
    const finmind = mockAdapter({
      fetchNews: vi.fn().mockResolvedValue([{ market: 'TW' }]),
    })
    const twse = mockAdapter({})
    const chain = new TaiwanPriceProviderChain(finmind, [twse])

    await chain.fetchNews('TW')
    expect(finmind.fetchNews).toHaveBeenCalledWith('TW')
    expect(twse.fetchNews).not.toHaveBeenCalled()
  })
})
