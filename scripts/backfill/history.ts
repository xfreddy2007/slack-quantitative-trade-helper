/**
 * §07 live-history backfill — builds the out-of-sample HOLDOUT price corpus.
 *
 *   npx tsx scripts/backfill/history.ts
 *
 * Fetches REAL end-of-day closes for the backtest portfolio symbols and writes a frozen
 * holdout corpus under scripts/backtest-holdout/. This is the "two-corpora" model (§07):
 *
 *   - REGRESSION corpus  = scripts/backtest-2025/  (memory-RECONSTRUCTED prices; deterministic;
 *                          the §04 baselines are frozen against it — never touched by this script)
 *   - HOLDOUT   corpus   = scripts/backtest-holdout/ (SAME labeled events.json, REAL prices) —
 *                          re-run the backtest here to check the reconstructed-price conclusions
 *                          hold up under real data. Out-of-sample for prices, not for labels.
 *
 * Providers (real history, free tier):
 *   - VOO       → Alpha Vantage TIME_SERIES_DAILY (US, 20+yr daily)        [ALPHA_VANTAGE_API_KEY]
 *   - 0050.TW   → FinMind TaiwanStockPrice (date-ranged; the 7-day adapter  [FINMIND_API_TOKEN]
 *   - 2330.TW     cap is app-side, the API itself takes start_date/end_date)
 *   - cash      → synthetic constant 1.0 across the union of trading dates
 *
 * Network + tokens required. Output is committed as a FROZEN snapshot; this script is the
 * reproducer. Secrets come from .env (minimal parser; never `export $(grep .env|xargs)`).
 *
 * Spec: docs/evaluation/07-data-and-provider-validation.md
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const SRC_CORPUS = resolve(PROJECT_ROOT, 'scripts/backtest-2025')
const OUT_CORPUS = resolve(PROJECT_ROOT, 'scripts/backtest-holdout')

// Window: cover the curated 2025 events + the longest forward horizon (63d) past the last event.
const WINDOW = { start: '2025-01-01', end: '2026-03-31' }
const FINMIND_API_URL = 'https://api.finmindtrade.com/api/v4/data'
const AV_API_URL = 'https://www.alphavantage.co/query'

interface PricePt { date: string; price: number }

function loadEnv(): void {
  const envPath = resolve(PROJECT_ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const eq = t.indexOf('=')
    const key = t.slice(0, eq).trim()
    if (key && !(key in process.env)) process.env[key] = t.slice(eq + 1).trim()
  }
}

function inWindow(date: string): boolean {
  return date >= WINDOW.start && date <= WINDOW.end
}

// ── FinMind: TaiwanStockPrice, date-ranged (replicates the adapter request with a wide window) ──
async function fetchFinMind(dataId: string, token: string): Promise<PricePt[]> {
  const params = new URLSearchParams({
    dataset: 'TaiwanStockPrice',
    data_id: dataId,
    start_date: WINDOW.start,
    end_date: WINDOW.end,
    token,
  })
  const res = await fetch(`${FINMIND_API_URL}?${params.toString()}`)
  if (res.status === 401) throw new Error('FinMind HTTP 401 — FINMIND_API_TOKEN expired/invalid')
  if (res.status === 429) throw new Error('FinMind HTTP 429 — daily quota reached')
  if (!res.ok) throw new Error(`FinMind HTTP ${res.status}`)
  const body = (await res.json()) as { msg: string; status: number; data: { date: string; close: number }[] }
  if (!Array.isArray(body.data) || body.data.length === 0) {
    throw new Error(`FinMind returned no data for ${dataId} (status=${body.status} msg=${body.msg})`)
  }
  return body.data
    .filter((r) => inWindow(r.date))
    .map((r) => ({ date: r.date, price: r.close }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ── Alpha Vantage: TIME_SERIES_DAILY. NOTE: outputsize=full is now a PREMIUM feature; the
// free tier only serves `compact` (~last 100 trading days), which cannot reach a 2025-01 window.
// So US deep history via AV-free is BLOCKED. Returns [] when the free response can't cover the
// window start; the caller carries the reconstructed VOO series instead (honest fallback). A
// non-AV US history source (Twelve Data / Finnhub free) is the real fix — see §07.
async function fetchAlphaVantage(symbol: string, apiKey: string): Promise<PricePt[]> {
  const url = `${AV_API_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`)
  const body = (await res.json()) as Record<string, unknown> & {
    'Time Series (Daily)'?: Record<string, Record<string, string>>
  }
  const series = body['Time Series (Daily)']
  if (!series) {
    const reason = (body.Information ?? body.Note ?? body['Error Message'] ?? 'no time series') as string
    console.warn(`  ⚠ Alpha Vantage no usable series for ${symbol}: ${reason}`)
    return []
  }
  const pts = Object.entries(series)
    .filter(([date]) => inWindow(date))
    .map(([date, ohlc]) => ({ date, price: Number(ohlc['4. close']) }))
    .sort((a, b) => a.date.localeCompare(b.date))
  // Free `compact` can't cover the window start → unusable as a 2025 holdout series.
  if (pts.length === 0 || pts[0].date > WINDOW.start) {
    console.warn(`  ⚠ Alpha Vantage free tier covers only ${pts[0]?.date ?? 'nothing'}..${pts.at(-1)?.date ?? ''} (need from ${WINDOW.start}); US-real history unavailable on free tier`)
    return []
  }
  return pts
}

/** Carry the reconstructed VOO series from the regression corpus when real US history isn't available. */
function reconstructedSeries(symbol: string): PricePt[] {
  const doc = JSON.parse(readFileSync(resolve(SRC_CORPUS, 'prices.json'), 'utf8')) as { series: Record<string, PricePt[]> }
  return (doc.series[symbol] ?? []).filter((p) => inWindow(p.date))
}

async function main(): Promise<void> {
  loadEnv()
  const finmindToken = process.env.FINMIND_API_TOKEN
  const avKey = process.env.ALPHA_VANTAGE_API_KEY
  if (!finmindToken) throw new Error('FINMIND_API_TOKEN not set (.env)')
  if (!avKey) throw new Error('ALPHA_VANTAGE_API_KEY not set (.env)')

  console.log(`[backfill] window ${WINDOW.start}..${WINDOW.end}`)
  console.log('[backfill] VOO via Alpha Vantage…')
  let voo = await fetchAlphaVantage('VOO', avKey)
  let vooSource: 'alpha-vantage' | 'reconstructed-carryover' = 'alpha-vantage'
  if (voo.length === 0) {
    voo = reconstructedSeries('VOO')
    vooSource = 'reconstructed-carryover'
    console.log(`  VOO: carried ${voo.length} reconstructed rows (AV free tier can't reach the window — see §07)`)
  } else {
    console.log(`  VOO: ${voo.length} real rows (${voo[0]?.date}..${voo.at(-1)?.date})`)
  }
  console.log('[backfill] 0050.TW via FinMind…')
  const etf = await fetchFinMind('0050', finmindToken)
  console.log(`  0050.TW: ${etf.length} rows (${etf[0]?.date}..${etf.at(-1)?.date})`)
  console.log('[backfill] 2330.TW via FinMind…')
  const tsmc = await fetchFinMind('2330', finmindToken)
  console.log(`  2330.TW: ${tsmc.length} rows (${tsmc[0]?.date}..${tsmc.at(-1)?.date})`)

  // cash = synthetic constant 1.0 over the union of real trading dates.
  const allDates = [...new Set([...voo, ...etf, ...tsmc].map((p) => p.date))].sort()
  const cash: PricePt[] = allDates.map((date) => ({ date, price: 1 }))

  const series: Record<string, PricePt[]> = { VOO: voo, '0050.TW': etf, '2330.TW': tsmc, cash }

  mkdirSync(OUT_CORPUS, { recursive: true })

  const vooNote = vooSource === 'alpha-vantage' ? 'real' : 'RECONSTRUCTED carryover (AV free tier blocked)'
  const prices = {
    _provenance: `Out-of-sample HOLDOUT corpus (§07). TW (0050/2330) = REAL FinMind EOD; VOO = ${vooNote}; cash = synthetic. Pairs with the same labeled events.json as scripts/backtest-2025. Do NOT use to set §04 regression baselines. See provenance.json.`,
    series,
  }
  writeFileSync(resolve(OUT_CORPUS, 'prices.json'), JSON.stringify(prices, null, 2))

  // Reuse the SAME labeled events (two-corpora: same labels, real prices).
  copyFileSync(resolve(SRC_CORPUS, 'events.json'), resolve(OUT_CORPUS, 'events.json'))

  const span = (s: PricePt[]) => ({ rows: s.length, first: s[0]?.date ?? null, last: s.at(-1)?.date ?? null })
  const provenance = {
    generatedAt: new Date().toISOString(),
    purpose: 'out-of-sample HOLDOUT — real EOD closes for the curated 2025 events; two-corpora model (§07)',
    window: WINDOW,
    eventsFrom: 'scripts/backtest-2025/events.json (copied — same ground-truth labels)',
    sources: {
      VOO:
        vooSource === 'alpha-vantage'
          ? { provider: 'alpha-vantage', endpoint: 'TIME_SERIES_DAILY', real: true, ...span(voo) }
          : { provider: 'reconstructed-carryover', real: false, note: 'AV free tier blocks deep history (outputsize=full is premium); carried from scripts/backtest-2025/prices.json. TODO §07: switch US to Twelve Data / Finnhub free history.', ...span(voo) },
      '0050.TW': { provider: 'finmind', dataset: 'TaiwanStockPrice', dataId: '0050', real: true, ...span(etf) },
      '2330.TW': { provider: 'finmind', dataset: 'TaiwanStockPrice', dataId: '2330', real: true, ...span(tsmc) },
      cash: { provider: 'synthetic', real: false, note: 'constant 1.0 over union of trading dates', ...span(cash) },
    },
  }
  writeFileSync(resolve(OUT_CORPUS, 'provenance.json'), JSON.stringify(provenance, null, 2))

  console.log(`\n[backfill] wrote holdout corpus → ${OUT_CORPUS.replace(PROJECT_ROOT + '/', '')}/`)
  console.log(`  prices.json (${allDates.length} union dates) · events.json (copied) · provenance.json`)
  console.log('  next: BT_DATA_DIR=scripts/backtest-holdout npx tsx scripts/backtest-2025/run.ts')
}

main().catch((e) => {
  console.error(`[backfill] FAILED: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
