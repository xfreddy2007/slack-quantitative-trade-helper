import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { scoreItem } from '../../../src/orchestration/triggerScoring.js'
import { checkThreshold } from '../../../src/orchestration/alertThreshold.js'
import type { NormalizedNewsItem } from '../../../src/providers/adapter.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = resolve(__dirname, '../../../../../packages/fixtures/backtest/regression-fn-2025.json')

interface Fn { id: string; market: string; title: string; content: string; source_url: string; published_at: string }
const fns: Fn[] = JSON.parse(readFileSync(FILE, 'utf-8'))

function fires(f: Fn): boolean {
  const score = scoreItem(f as unknown as NormalizedNewsItem)
  return checkThreshold(score.severity, score.confidence, score.relevance).decision === 'post'
}

/** Regression guard: the 4 false-negatives from the 2025 backtest must not silently regress. */
describe('2025 FN regression fixtures', () => {
  it('all 4 single-market events now derive severity >= 4 (T1 — no structural suppression)', () => {
    for (const f of fns) {
      const s = scoreItem(f as unknown as NormalizedNewsItem)
      expect(s.severity, f.id).toBeGreaterThanOrEqual(4)
    }
  })

  it('the 3 high-conviction acute shocks fire as alerts', () => {
    const acute = ['fn-2025-04-tw-limitdown', 'fn-2025-05-twd-surge', 'fn-2025-11-ai-bubble']
    for (const id of acute) {
      const f = fns.find((x) => x.id === id)!
      expect(fires(f), id).toBe(true)
    }
  })

  it('the hedged/unconfirmed growth-scare stays suppressed on low reliability-confidence', () => {
    const f = fns.find((x) => x.id === 'fn-2025-03-growth-scare')!
    expect(scoreItem(f as unknown as NormalizedNewsItem).confidence).toBeLessThanOrEqual(2)
    expect(fires(f)).toBe(false)
  })
})
