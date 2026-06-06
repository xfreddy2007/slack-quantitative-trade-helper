import type { NormalizedNewsItem } from '../providers/adapter.js'
import type { Market } from '@schemas/zod'

const TW_SIGNALS = [
  '台積電', '台股', '加權指數', '外資', '電子', '半導體', '台灣', 'TSE',
  '.TW', '2330', '0050', '台幣', 'TAIEX',
]

const US_SIGNALS = [
  'Federal Reserve', 'Fed', 'S&P 500', 'S&P500', 'PCE', 'Treasury',
  'Dow Jones', 'NASDAQ', 'interest rate', 'rate cut', 'rate hike',
  'equity market', 'bond yield', 'USD', 'inflation', 'labor market',
]

const GLOBAL_SIGNALS = [
  'Taiwan Strait', 'PLA', 'military exercise', 'blockade', 'geopolitical',
  'supply chain disruption', 'regional market', 'USD/TWD', 'Level-3 alert',
  'naval vessel', 'live-fire', 'escalat',
]

function score(text: string, signals: string[]): number {
  const lower = text.toLowerCase()
  return signals.reduce((acc, s) => acc + (lower.includes(s.toLowerCase()) ? 1 : 0), 0)
}

export function classifyMarket(item: NormalizedNewsItem): Market {
  const text = `${item.title} ${item.content}`
  const twScore = score(text, TW_SIGNALS)
  const usScore = score(text, US_SIGNALS)
  const globalScore = score(text, GLOBAL_SIGNALS)

  if (globalScore > 0 && globalScore >= usScore) return 'GLOBAL'
  if (twScore > usScore) return 'TW'
  if (usScore > twScore) return 'US'
  if (twScore > 0) return 'TW'

  return item.market
}

export function classifyAll(items: NormalizedNewsItem[]): NormalizedNewsItem[] {
  return items.map((item) => ({ ...item, market: classifyMarket(item) }))
}
