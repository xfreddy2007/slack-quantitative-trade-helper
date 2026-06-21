import type { Market } from '@schemas/zod'
import type { ProviderAdapter, NormalizedNewsItem, NormalizedPriceSnapshot } from './adapter.js'

// TPEX Open API — OTC (over-the-counter) mainboard EOD quotes (free, authoritative).
const TPEX_DAILY_QUOTES_URL =
  'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes'

export type TpexQuoteRow = {
  Date: string // ROC format, e.g. "1150529" = 2026-05-29
  SecuritiesCompanyCode: string
  CompanyName: string
  Close: string
  Change: string
  Open: string
  High: string
  Low: string
  TradingShares: string
  TransactionAmount: string
}

function toTpexCode(symbol: string): string {
  return symbol.replace(/\.TW$/i, '')
}

// ROC date "1150529" → ISO at OTC close (13:30 Taipei = 05:30 UTC). ROC year + 1911 = Gregorian.
function rocDateToIso(roc: string): string {
  const trimmed = roc.trim()
  const year = Number(trimmed.slice(0, trimmed.length - 4)) + 1911
  const month = trimmed.slice(-4, -2)
  const day = trimmed.slice(-2)
  return `${year}-${month}-${day}T05:30:00.000Z`
}

export function parseTpexPrice(rows: TpexQuoteRow[]): NormalizedPriceSnapshot[] {
  return rows.map((row): NormalizedPriceSnapshot => ({
    symbol: `${row.SecuritiesCompanyCode}.TW`,
    market: 'TW',
    price: Number(row.Close),
    currency: 'TWD',
    timestamp: rocDateToIso(row.Date),
    provider: 'tpex',
    volume: Number(row.TradingShares),
  }))
}

export class TpexAdapter implements ProviderAdapter {
  // TPEX Open API has no news feed.
  async fetchNews(_market: Market): Promise<NormalizedNewsItem[]> {
    return []
  }

  async fetchMarketSnapshot(symbols: string[]): Promise<NormalizedPriceSnapshot[]> {
    const res = await fetch(TPEX_DAILY_QUOTES_URL)
    if (!res.ok) throw new Error(`TPEX API error: ${res.status}`)
    const rows = (await res.json()) as TpexQuoteRow[]
    const wanted = new Set(symbols.map(toTpexCode))
    return parseTpexPrice(rows.filter((r) => wanted.has(r.SecuritiesCompanyCode)))
  }
}
