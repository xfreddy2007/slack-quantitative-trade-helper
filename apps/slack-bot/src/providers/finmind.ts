import type { Market } from '@schemas/zod'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'
import type { RateLimitGuard } from './rate-limit-guard.js'
import { AuthFailedError } from './failureBoundary.js'

const FINMIND_API_URL = 'https://api.finmindtrade.com/api/v4/data'

/** FinMind free-tier daily request cap. Construct the RateLimitGuard with this limit. */
export const FINMIND_DAILY_LIMIT = 600

/** Default lookback window for EOD/news queries (days). */
const LOOKBACK_DAYS = 7

type FinMindPriceRow = {
  date: string
  stock_id: string
  Trading_Volume: number
  Trading_money: number
  open: number
  max: number
  min: number
  close: number
  spread: number
  Trading_turnover: number
}

type FinMindNewsRow = {
  date: string
  stock_id: string
  link: string
  source: string
  title: string
}

export type FinMindResponse<T> = {
  msg: string
  status: number
  data: T[]
}

// "0050.TW" → "0050" (FinMind data_id); leave bare ids untouched.
function toFinMindId(symbol: string): string {
  return symbol.replace(/\.TW$/i, '')
}

// "0050" → "0050.TW" (shared symbol convention).
function toTwSymbol(stockId: string): string {
  return `${stockId}.TW`
}

// FinMind EOD date "2026-05-29" → TWSE close (13:30 Taipei = 05:30 UTC).
function priceDateToIso(date: string): string {
  return `${date.trim()}T05:30:00.000Z`
}

// FinMind news date "2026-05-29 08:30:00" (Taipei) or "2026-05-29" → ISO 8601 UTC.
function newsDateToIso(date: string): string {
  const trimmed = date.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T00:00:00.000Z`
  return new Date(`${trimmed.replace(' ', 'T')}+08:00`).toISOString()
}

export function parseFinMindPrice(
  resp: FinMindResponse<FinMindPriceRow>
): NormalizedPriceSnapshot[] {
  // PriceSnapshotFixture carries a single `price`; we normalize to the EOD close.
  return resp.data.map((row): NormalizedPriceSnapshot => ({
    symbol: toTwSymbol(row.stock_id),
    market: 'TW',
    price: row.close,
    currency: 'TWD',
    timestamp: priceDateToIso(row.date),
    provider: 'finmind',
    volume: row.Trading_Volume,
  }))
}

export function parseFinMindNews(resp: FinMindResponse<FinMindNewsRow>): NormalizedNewsItem[] {
  return resp.data.map((row): NormalizedNewsItem => ({
    title: row.title,
    source_url: row.link,
    market: 'TW',
    published_at: newsDateToIso(row.date),
    content: row.title,
    author: row.source,
    provider: 'finmind',
  }))
}

export class FinMindAdapter implements ProviderAdapter {
  constructor(
    private readonly token: string,
    private readonly rateLimitGuard?: RateLimitGuard
  ) {}

  // FinMind news (TaiwanStockNews) is Taiwan-only; short-circuit other markets.
  async fetchNews(market: Market): Promise<NormalizedNewsItem[]> {
    if (market !== 'TW') return []
    this.rateLimitGuard?.check()
    return parseFinMindNews(await this.request<FinMindNewsRow>('TaiwanStockNews'))
  }

  async fetchMarketSnapshot(symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    const out: NormalizedPriceSnapshot[] = []
    // FinMind TaiwanStockPrice is queried per stock_id, so one request per symbol.
    for (const symbol of symbols) {
      this.rateLimitGuard?.check()
      out.push(...parseFinMindPrice(await this.request<FinMindPriceRow>('TaiwanStockPrice', toFinMindId(symbol))))
    }
    return out
  }

  private async request<T>(dataset: string, dataId?: string): Promise<FinMindResponse<T>> {
    const startDate = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
    const params = new URLSearchParams({ dataset, start_date: startDate, token: this.token })
    if (dataId) params.set('data_id', dataId)

    const res = await fetch(`${FINMIND_API_URL}?${params.toString()}`)
    // HTTP 401 = token expired or invalid; surface as AuthFailedError so the failure boundary
    // records `provider_run.status = auth_failed` instead of a generic failure.
    if (res.status === 401) {
      throw new AuthFailedError('FinMind authentication failed (HTTP 401): token expired or invalid')
    }
    if (!res.ok) throw new Error(`FinMind API error: ${res.status}`)
    return (await res.json()) as FinMindResponse<T>
  }
}
