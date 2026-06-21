import type { Market } from '@schemas/zod'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'

// TWSE Open API — listed-market EOD quotes for the latest trading day (free, authoritative).
const TWSE_STOCK_DAY_ALL_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'

export type TwseStockDayRow = {
  Code: string
  Name: string
  TradeVolume: string
  TradeValue: string
  OpeningPrice: string
  HighestPrice: string
  LowestPrice: string
  ClosingPrice: string
  Change: string
  Transaction: string
}

function toTwseCode(symbol: string): string {
  return symbol.replace(/\.TW$/i, '')
}

// TWSE STOCK_DAY_ALL carries no per-row date; stamp the latest TWSE close (13:30 Taipei = 05:30 UTC).
function twseEodTimestamp(now: Date = new Date()): string {
  return `${now.toISOString().slice(0, 10)}T05:30:00.000Z`
}

export function parseTwsePrice(
  rows: TwseStockDayRow[],
  timestamp: string = twseEodTimestamp()
): NormalizedPriceSnapshot[] {
  return rows.map((row): NormalizedPriceSnapshot => ({
    symbol: `${row.Code}.TW`,
    market: 'TW',
    price: Number(row.ClosingPrice),
    currency: 'TWD',
    timestamp,
    provider: 'twse',
    volume: Number(row.TradeVolume),
  }))
}

export class TwseAdapter implements ProviderAdapter {
  // TWSE Open API has no news feed.
  async fetchNews(_market: Market): Promise<NormalizedNewsItem[]> {
    return []
  }

  async fetchMarketSnapshot(symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    const res = await fetch(TWSE_STOCK_DAY_ALL_URL)
    if (!res.ok) throw new Error(`TWSE API error: ${res.status}`)
    const rows = (await res.json()) as TwseStockDayRow[]
    const wanted = new Set(symbols.map(toTwseCode))
    return parseTwsePrice(rows.filter((r) => wanted.has(r.Code)))
  }
}
