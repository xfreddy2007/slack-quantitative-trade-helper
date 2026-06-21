import { describe, it, expect } from 'vitest'
import {
  classifyEvent,
  runBacktest,
  renderBacktestReport,
  loadBacktestEvents,
  type BacktestEvent,
} from '../../../src/orchestration/backtestFixtures.js'

function event(overrides: Partial<BacktestEvent>): BacktestEvent {
  return {
    id: 'bt-test',
    category: 'geopolitical',
    market: 'US',
    title: 'test event',
    source_url: 'https://example.com/bt-test',
    published_at: '2026-03-01T00:00:00.000Z',
    content: 'test content',
    expected_severity: 4,
    expected_confidence: 3,
    expected_alert: true,
    ...overrides,
  }
}

describe('backtest classifyEvent', () => {
  it('TP: fires and was expected to alert', () => {
    const o = classifyEvent(event({ expected_severity: 5, expected_alert: true }))
    expect(o.fired).toBe(true)
    expect(o.classification).toBe('TP')
  })

  it('FP: fires but should not have alerted', () => {
    const o = classifyEvent(event({ expected_severity: 4, expected_confidence: 3, expected_alert: false }))
    expect(o.fired).toBe(true)
    expect(o.classification).toBe('FP')
  })

  it('TN: suppressed and was not expected to alert', () => {
    const o = classifyEvent(event({ expected_severity: 3, expected_alert: false }))
    expect(o.fired).toBe(false)
    expect(o.classification).toBe('TN')
  })

  it('FN: suppressed but should have alerted (low confidence)', () => {
    const o = classifyEvent(event({ expected_severity: 4, expected_confidence: 2, expected_alert: true }))
    expect(o.fired).toBe(false)
    expect(o.classification).toBe('FN')
  })
})

describe('backtest runBacktest aggregation', () => {
  const events: BacktestEvent[] = [
    event({ id: 'a', expected_severity: 5, expected_alert: true }), // TP
    event({ id: 'b', expected_severity: 4, expected_confidence: 3, expected_alert: false }), // FP
    event({ id: 'c', expected_severity: 3, expected_alert: false }), // TN
    event({ id: 'd', expected_severity: 4, expected_confidence: 2, expected_alert: true }), // FN
  ]

  it('counts each outcome class and computes FP rate over fired alerts', () => {
    const r = runBacktest(events)
    expect(r.total).toBe(4)
    expect(r.truePositives).toBe(1)
    expect(r.falsePositives).toBe(1)
    expect(r.trueNegatives).toBe(1)
    expect(r.falseNegatives).toBe(1)
    expect(r.alertsFired).toBe(2)
    expect(r.suppressed).toBe(2)
    expect(r.fpRate).toBeCloseTo(0.5, 5) // 1 FP / 2 fired
  })

  it('FP rate is 0 when nothing fires', () => {
    const r = runBacktest([event({ expected_severity: 3, expected_alert: false })])
    expect(r.alertsFired).toBe(0)
    expect(r.fpRate).toBe(0)
  })

  it('is repeatable: identical input yields identical counts', () => {
    expect(runBacktest(events)).toEqual(runBacktest(events))
  })
})

describe('backtest report rendering + shipped fixtures', () => {
  it('renders a markdown report with summary and per-event rows', () => {
    const r = runBacktest([event({ id: 'row-1', expected_severity: 5 })])
    const md = renderBacktestReport(r, '2026-06-20', 30)
    expect(md).toContain('# Trigger Backtest Results — 2026-06-20')
    expect(md).toContain('| FP rate | 0.0% |')
    expect(md).toContain('row-1')
    expect(md).toContain('✅ PASS')
  })

  it('shipped fixture library covers all 10 PRD categories across TW and US, FP rate within gate', () => {
    const events = loadBacktestEvents()
    expect(events.length).toBeGreaterThanOrEqual(10)

    const categories = new Set(events.map((e) => e.category))
    for (const c of [
      'geopolitical',
      'central_bank',
      'inflation_shock',
      'recession_signal',
      'credit_stress',
      'earnings_shock',
      'regulatory',
      'index_drawdown',
      'commodity_shock',
      'currency_shock',
    ]) {
      expect(categories.has(c)).toBe(true)
    }
    const markets = new Set(events.map((e) => e.market))
    expect(markets.has('TW')).toBe(true)
    expect(markets.has('US')).toBe(true)

    const report = runBacktest(events)
    expect(report.fpRate * 100).toBeLessThanOrEqual(30)
  })
})
