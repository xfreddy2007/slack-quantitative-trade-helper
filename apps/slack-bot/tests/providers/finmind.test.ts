import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  FinMindAdapter,
  parseFinMindPrice,
  parseFinMindNews,
  FINMIND_DAILY_LIMIT,
  type FinMindResponse,
} from '../../src/providers/finmind.js'
import { AuthFailedError } from '../../src/providers/failureBoundary.js'
import { RateLimitGuard, RateLimitExceeded } from '../../src/providers/rate-limit-guard.js'
import { runIsolated, type ProviderRunRecorder } from '../../src/providers/failureBoundary.js'
import { PriceSnapshotFixtureSchema } from '@schemas/zod/price-snapshot-fixture'
import { NewsFixtureSchema } from '@schemas/zod/news-fixture'
import { join } from 'path'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = resolve(__dirname, '../../../../packages/fixtures')

function loadPriceFixture(): FinMindResponse<never> {
  return JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, 'provider-payloads/finmind-price.json'), 'utf-8')
  )
}
function loadNewsFixture(): FinMindResponse<never> {
  return JSON.parse(
    readFileSync(resolve(FIXTURES_DIR, 'provider-payloads/finmind-news.json'), 'utf-8')
  )
}
function tempPath(): string {
  return join(tmpdir(), `finmind-rl-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
}
function okResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response
}

describe('finmind: parseFinMindPrice', () => {
  it('normalizes TaiwanStockPrice rows to NormalizedPriceSnapshot (close → price)', () => {
    const result = parseFinMindPrice(loadPriceFixture())
    expect(result).toHaveLength(2)
    const last = result[1]
    expect(last.symbol).toBe('0050.TW')
    expect(last.market).toBe('TW')
    expect(last.price).toBe(148.5) // EOD close
    expect(last.currency).toBe('TWD')
    expect(last.volume).toBe(12500000)
    expect(last.timestamp).toBe('2026-05-29T05:30:00.000Z')
    expect(last.provider).toBe('finmind')
  })

  it('every record validates against PriceSnapshotFixtureSchema', () => {
    for (const snap of parseFinMindPrice(loadPriceFixture())) {
      expect(() => PriceSnapshotFixtureSchema.parse(snap)).not.toThrow()
    }
  })
})

describe('finmind: parseFinMindNews', () => {
  it('normalizes TaiwanStockNews rows to NormalizedNewsItem with market TW and zh-TW content', () => {
    const result = parseFinMindNews(loadNewsFixture())
    expect(result).toHaveLength(2)
    const first = result[0]
    expect(first.market).toBe('TW')
    expect(first.provider).toBe('finmind')
    expect(first.source_url).toBe('https://news.cnyes.com/news/id/5912345')
    expect(first.author).toBe('鉅亨網')
    // Traditional Chinese content present
    expect(first.content).toMatch(/[一-鿿]/)
    expect(first.published_at).toBe('2026-05-29T00:30:00.000Z') // 08:30 Taipei → 00:30 UTC
  })

  it('every record validates against NewsFixtureSchema', () => {
    for (const item of parseFinMindNews(loadNewsFixture())) {
      expect(() => NewsFixtureSchema.parse(item)).not.toThrow()
    }
  })
})

describe('finmind: FinMindAdapter', () => {
  afterEach(() => vi.restoreAllMocks())

  it('fetchMarketSnapshot fetches TaiwanStockPrice for 0050.TW from recorded fixture', async () => {
    const guard = { check: vi.fn() }
    const fetchMock = vi.fn().mockResolvedValue(okResponse(loadPriceFixture()))
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new FinMindAdapter('test-token', guard as never)
    const result = await adapter.fetchMarketSnapshot(['0050.TW'])

    expect(guard.check).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
    // request targets TaiwanStockPrice with the bare data_id
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('dataset=TaiwanStockPrice')
    expect(url).toContain('data_id=0050')
    expect(result[1].price).toBe(148.5)
  })

  it('fetchNews returns Taiwan news from recorded fixture', async () => {
    const guard = { check: vi.fn() }
    const fetchMock = vi.fn().mockResolvedValue(okResponse(loadNewsFixture()))
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new FinMindAdapter('test-token', guard as never)
    const result = await adapter.fetchNews('TW')

    expect(result).toHaveLength(2)
    expect(result.every((n) => n.market === 'TW')).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain('dataset=TaiwanStockNews')
  })

  it('fetchNews short-circuits non-TW markets without touching guard or network', async () => {
    const guard = { check: vi.fn() }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new FinMindAdapter('test-token', guard as never)
    expect(await adapter.fetchNews('US')).toEqual([])
    expect(guard.check).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('finmind: rate limit manager', () => {
  afterEach(() => vi.restoreAllMocks())

  it('exposes the 600/day free-tier cap', () => {
    expect(FINMIND_DAILY_LIMIT).toBe(600)
  })

  it('blocks calls beyond the daily cap with RateLimitExceeded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(loadPriceFixture()))
    vi.stubGlobal('fetch', fetchMock)
    const guard = new RateLimitGuard(tempPath(), { limit: 2, provider: 'FinMind' })
    const adapter = new FinMindAdapter('test-token', guard)

    await adapter.fetchMarketSnapshot(['0050.TW']) // 1
    await adapter.fetchMarketSnapshot(['0050.TW']) // 2
    await expect(adapter.fetchMarketSnapshot(['0050.TW'])).rejects.toBeInstanceOf(RateLimitExceeded)
  })
})

describe('finmind: auth failure isolation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('throws AuthFailedError on HTTP 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response)
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new FinMindAdapter('expired-token')
    await expect(adapter.fetchMarketSnapshot(['0050.TW'])).rejects.toBeInstanceOf(AuthFailedError)
  })

  it('records provider_run status "auth_failed" via the failure boundary without crashing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response)
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new FinMindAdapter('expired-token')

    const completes: Array<{ status: string; errorMessage?: string }> = []
    const recorder: ProviderRunRecorder = {
      async createProviderRun() {
        return 'run-1'
      },
      async completeProviderRun(_id, opts) {
        completes.push(opts)
      },
    }

    const res = await runIsolated(recorder, 'finmind', [], async () => ({
      data: await adapter.fetchMarketSnapshot(['0050.TW']),
    }))

    expect(res.status).toBe('auth_failed')
    expect(res.data).toEqual([])
    expect(completes[0].status).toBe('auth_failed')
    expect(completes[0].errorMessage).toContain('401')
  })
})
