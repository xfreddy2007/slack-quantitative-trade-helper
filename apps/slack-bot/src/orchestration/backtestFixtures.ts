import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import type { NormalizedNewsItem } from '../providers/adapter.js'
import { scoreItem } from './triggerScoring.js'
import { checkThreshold } from './alertThreshold.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../../../../')
const DEFAULT_MAX_FP_RATE_PCT = 30

/** A historical event fixture: a news item plus its human-labeled ground-truth alert outcome. */
export interface BacktestEvent extends NormalizedNewsItem {
  id: string
  category: string
  /** Ground truth: should this event have fired a portfolio alert? */
  expected_alert: boolean
}

export type Classification = 'TP' | 'FP' | 'TN' | 'FN'

export interface EventOutcome {
  id: string
  category: string
  market: string
  severity: number
  confidence: number
  relevance: number
  decision: 'post' | 'suppress'
  fired: boolean
  expectedAlert: boolean
  classification: Classification
}

export interface BacktestReport {
  total: number
  alertsFired: number
  suppressed: number
  truePositives: number
  trueNegatives: number
  falsePositives: number
  falseNegatives: number
  /** False positives as a share of fired alerts (false-discovery rate); 0 when nothing fired. */
  fpRate: number
  outcomes: EventOutcome[]
}

/** Replay trigger scoring + threshold for one event and label it against ground truth. */
export function classifyEvent(event: BacktestEvent): EventOutcome {
  const score = scoreItem(event)
  const { decision } = checkThreshold(score.severity, score.confidence, score.relevance)
  const fired = decision === 'post'
  const classification: Classification = fired
    ? event.expected_alert
      ? 'TP'
      : 'FP'
    : event.expected_alert
      ? 'FN'
      : 'TN'

  return {
    id: event.id,
    category: event.category,
    market: event.market,
    severity: score.severity,
    confidence: score.confidence,
    relevance: score.relevance,
    decision,
    fired,
    expectedAlert: event.expected_alert,
    classification,
  }
}

export function runBacktest(events: BacktestEvent[]): BacktestReport {
  const outcomes = events.map(classifyEvent)
  const count = (c: Classification): number => outcomes.filter((o) => o.classification === c).length
  const truePositives = count('TP')
  const falsePositives = count('FP')
  const trueNegatives = count('TN')
  const falseNegatives = count('FN')
  const alertsFired = truePositives + falsePositives
  const fpRate = alertsFired === 0 ? 0 : falsePositives / alertsFired

  return {
    total: events.length,
    alertsFired,
    suppressed: trueNegatives + falseNegatives,
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    fpRate,
    outcomes,
  }
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function renderBacktestReport(
  report: BacktestReport,
  dateStr: string,
  maxFpRatePct: number
): string {
  const gatePassed = report.fpRate * 100 <= maxFpRatePct
  const header = [
    `# Trigger Backtest Results — ${dateStr}`,
    '',
    `- Model: trigger-scoring-v1`,
    `- FP-rate gate: ${maxFpRatePct}% (false positives / alerts fired)`,
    `- Gate: ${gatePassed ? '✅ PASS' : '❌ FAIL'}`,
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|---|---|',
    `| Total events | ${report.total} |`,
    `| Alerts fired | ${report.alertsFired} |`,
    `| Suppressed | ${report.suppressed} |`,
    `| True positives | ${report.truePositives} |`,
    `| True negatives | ${report.trueNegatives} |`,
    `| Estimated false positives | ${report.falsePositives} |`,
    `| Estimated false negatives | ${report.falseNegatives} |`,
    `| FP rate | ${pct(report.fpRate)} |`,
    '',
    '## Per-event results',
    '',
    '| ID | Category | Market | Sev | Conf | Rel | Decision | Expected | Result |',
    '|---|---|---|---|---|---|---|---|---|',
  ]
  const rows = report.outcomes.map((o) =>
    `| ${o.id} | ${o.category} | ${o.market} | ${o.severity} | ${o.confidence} | ${o.relevance} | ${o.decision} | ${o.expectedAlert ? 'alert' : 'no-alert'} | ${o.classification} |`
  )
  return [...header, ...rows, ''].join('\n')
}

/** Taipei (UTC+8, no DST) calendar date as YYYY-MM-DD. */
function taipeiDateStr(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function loadBacktestEvents(
  path = resolve(PROJECT_ROOT, 'packages/fixtures/backtest/events.json')
): BacktestEvent[] {
  return JSON.parse(readFileSync(path, 'utf-8')) as BacktestEvent[]
}

function main(): void {
  const maxFpRatePct = Number(process.env.BACKTEST_MAX_FP_RATE_PCT ?? DEFAULT_MAX_FP_RATE_PCT)
  const events = loadBacktestEvents()
  const report = runBacktest(events)
  const dateStr = taipeiDateStr()

  const outDir = resolve(PROJECT_ROOT, 'docs/backtest-results')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `${dateStr}.md`)
  writeFileSync(outPath, renderBacktestReport(report, dateStr, maxFpRatePct))

  console.log(`Backtest complete: ${report.total} events, ${report.alertsFired} fired, ${report.suppressed} suppressed`)
  console.log(`FP rate: ${pct(report.fpRate)} (FP=${report.falsePositives}, FN=${report.falseNegatives})`)
  console.log(`Report: ${outPath}`)

  if (report.fpRate * 100 > maxFpRatePct) {
    console.error(`FP rate ${pct(report.fpRate)} exceeds gate of ${maxFpRatePct}% — failing backtest.`)
    process.exit(1)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
