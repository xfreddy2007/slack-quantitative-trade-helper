/**
 * §06 Robustness & Overfitting audit — Deep tier, REPORT-ONLY (never gates).
 *
 *   npx tsx scripts/robustness/run.ts          # default = backtest-2025 (20-event) set
 *   BT_DATA_DIR=scripts/backtest-30d npx tsx scripts/robustness/run.ts
 *
 * The app has NO fitted parameters — scoreItem/checkThreshold are fixed rules. So the
 * real overfitting risk is the THRESHOLD CUTOFFS (the tunable knobs someone could have
 * tuned to the fixtures). This audit probes that directly:
 *
 *   1. Threshold-sensitivity sweep — perturb severity/confidence/relevance cutoffs and
 *      watch precision/recall/FP-rate. A robust rule degrades gracefully, not off a cliff.
 *      (The core overfitting probe — genuinely meaningful even on a small set.)
 *   2. Walk-forward temporal split — confusion matrix on an early in-sample slice vs a
 *      late out-of-sample slice. With no fitted params this is a TEMPORAL-STABILITY check
 *      (not train/validate). Tiny N → emitted with an explicit insufficient-N warning.
 *   3. PBO (CSCV) + deflated Sharpe — DEFERRED: need a larger out-of-sample corpus (§07).
 *      N=20 is too small for combinatorial cross-validation / multiple-testing correction.
 *
 * The confusion matrix depends ONLY on (fired, expected_alert) — no price paths needed —
 * so this harness reuses the live scoring/threshold/budget functions and mirrors only the
 * budget-aware decision loop. A self-check asserts the baseline config reproduces the
 * canonical report.json confusion matrix (guards against the mirror drifting).
 *
 * Spec: docs/evaluation/06-robustness-and-overfitting.md
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { scoreItem } from '../../apps/slack-bot/src/orchestration/triggerScoring.js'
import {
  checkThreshold,
  DEFAULT_CUTOFFS,
  type ThresholdCutoffs,
} from '../../apps/slack-bot/src/orchestration/alertThreshold.js'
import {
  emptyBudget,
  checkBudget,
  incrementBudget,
  type DayBudget,
  type AlertMarket,
} from '../../apps/slack-bot/src/orchestration/alertBudget.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const DATA_DIR = process.env.BT_DATA_DIR ? resolve(process.env.BT_DATA_DIR) : resolve(PROJECT_ROOT, 'scripts/backtest-2025')
const OUT = resolve(__dirname, 'out')

interface Ev {
  id: string
  date: string
  category: string
  market: string
  title: string
  content: string
  source_url: string
  expected_alert: boolean
  relevant_symbol: string
}

const events: Ev[] = JSON.parse(readFileSync(resolve(DATA_DIR, 'events.json'), 'utf8'))
events.sort((a, b) => a.date.localeCompare(b.date))

interface Confusion {
  n: number
  fired: number
  TP: number
  FP: number
  TN: number
  FN: number
  precision: number
  recall: number
  fpRate: number
}

/** Run the live decision rule over a slice of events with a given cutoff config. */
function runConfig(slice: Ev[], cutoffs: ThresholdCutoffs): Confusion {
  const budgets: Record<string, DayBudget> = {}
  let TP = 0
  let FP = 0
  let TN = 0
  let FN = 0
  let fired = 0
  for (const ev of slice) {
    const score = scoreItem(ev as any)
    const th = checkThreshold(score.severity, score.confidence, score.relevance, cutoffs)
    let didFire = false
    if (th.decision === 'post') {
      const mkt = (ev.market === 'US' ? 'US' : ev.market === 'TW' ? 'TW' : 'GLOBAL') as AlertMarket
      const b = budgets[ev.date] ?? emptyBudget()
      const bud = checkBudget(b, mkt, score.severity)
      if (bud.decision === 'post') {
        didFire = true
        budgets[ev.date] = incrementBudget(b, mkt)
      } else {
        budgets[ev.date] = b
      }
    }
    if (didFire) fired++
    if (didFire) ev.expected_alert ? TP++ : FP++
    else ev.expected_alert ? FN++ : TN++
  }
  return {
    n: slice.length,
    fired,
    TP,
    FP,
    TN,
    FN,
    precision: TP + FP ? TP / (TP + FP) : 0,
    recall: TP + FN ? TP / (TP + FN) : 0,
    fpRate: fired ? FP / fired : 0,
  }
}

const r3 = (x: number) => Math.round(x * 1000) / 1000

// ── Self-check: baseline config must reproduce the canonical report.json confusion matrix ──
const base = runConfig(events, DEFAULT_CUTOFFS)
const canonicalPath = resolve(DATA_DIR, 'out', 'report.json')
let selfCheck: { ok: boolean; note: string } = { ok: true, note: 'no canonical report.json to compare (skipped)' }
if (existsSync(canonicalPath)) {
  const canon = JSON.parse(readFileSync(canonicalPath, 'utf8')).totals
  const ok = base.TP === canon.TP && base.FP === canon.FP && base.TN === canon.TN && base.FN === canon.FN
  selfCheck = ok
    ? { ok: true, note: `baseline matches report.json (TP${base.TP} FP${base.FP} TN${base.TN} FN${base.FN})` }
    : { ok: false, note: `MIRROR DRIFT: harness baseline TP${base.TP} FP${base.FP} TN${base.TN} FN${base.FN} != report.json TP${canon.TP} FP${canon.FP} TN${canon.TN} FN${canon.FN}` }
}

// ── 1. Threshold-sensitivity sweep ──
// Per-axis: perturb one cutoff ±1 around the baseline, hold the others at default.
const AXES: { axis: keyof ThresholdCutoffs; values: number[] }[] = [
  { axis: 'severity', values: [3, 4, 5] },
  { axis: 'confidence', values: [2, 3, 4] },
  { axis: 'relevance', values: [2, 3, 4] },
]
interface SweepRow {
  axis: string
  cutoffs: ThresholdCutoffs
  precision: number
  recall: number
  fpRate: number
  fired: number
  isBaseline: boolean
}
const perAxis: SweepRow[] = []
for (const { axis, values } of AXES) {
  for (const v of values) {
    const cutoffs = { ...DEFAULT_CUTOFFS, [axis]: v }
    const c = runConfig(events, cutoffs)
    perAxis.push({
      axis,
      cutoffs,
      precision: r3(c.precision),
      recall: r3(c.recall),
      fpRate: r3(c.fpRate),
      fired: c.fired,
      isBaseline: v === DEFAULT_CUTOFFS[axis],
    })
  }
}
// Swing = max-min of a metric across a set of single-axis perturbations.
const swingOf = (rows: SweepRow[]) => {
  const p = rows.map((r) => r.precision)
  const rc = rows.map((r) => r.recall)
  const f = rows.map((r) => r.fpRate)
  return {
    precision: r3(Math.max(...p) - Math.min(...p)),
    recall: r3(Math.max(...rc) - Math.min(...rc)),
    fpRate: r3(Math.max(...f) - Math.min(...f)),
  }
}
// Severity is the PRIMARY filter (decisive by design) — a large swing there is expected, not
// evidence of overfit. Hidden fixture-tuning shows in the SECONDARY knobs (confidence/relevance),
// so the stability grade is based on those; severity's swing is reported separately, not graded.
const primarySwing = swingOf(perAxis.filter((r) => r.axis === 'severity'))
const secondaryRows = perAxis.filter((r) => r.axis !== 'severity')
const secondarySwing = swingOf(secondaryRows)
const CLIFF_TOLERANCE = 0.25
const maxSecondarySwing = Math.max(secondarySwing.precision, secondarySwing.recall, secondarySwing.fpRate)
// Advisory label (report-only, NOT a verdict): does quality hold under ±1 moves of the secondary knobs?
const stability = maxSecondarySwing < CLIFF_TOLERANCE ? 'graceful' : 'sensitive'

// Full grid (3×3×3) — min/max envelope only (detail kept compact).
let gridMinPrec = 1
let gridMaxFp = 0
for (const s of AXES[0].values)
  for (const cf of AXES[1].values)
    for (const rl of AXES[2].values) {
      const c = runConfig(events, { severity: s, confidence: cf, relevance: rl })
      gridMinPrec = Math.min(gridMinPrec, c.precision)
      gridMaxFp = Math.max(gridMaxFp, c.fpRate)
    }

// ── 2. Walk-forward temporal split (in-sample early / out-of-sample late) ──
const splitIdx = Math.floor(events.length * 0.7)
const inSample = events.slice(0, splitIdx)
const outSample = events.slice(splitIdx)
const isC = runConfig(inSample, DEFAULT_CUTOFFS)
const oosC = runConfig(outSample, DEFAULT_CUTOFFS)
const MIN_OOS = 10
const oosWarning =
  oosC.n < MIN_OOS
    ? `insufficient-N: out-of-sample has ${oosC.n} events (< ${MIN_OOS}); indicative only, not statistically meaningful`
    : null

// ── 3. PBO / deflated Sharpe — deferred ──
const deferred = {
  status: 'deferred' as const,
  methods: ['PBO via CSCV', 'deflated Sharpe ratio'],
  reason: `requires a larger out-of-sample corpus (see §07); N=${events.length} is too small for combinatorial cross-validation / multiple-testing correction to be meaningful`,
}

// ── write report ──
mkdirSync(OUT, { recursive: true })
const report = {
  audit: 'robustness-and-overfitting',
  dataDir: DATA_DIR.replace(PROJECT_ROOT + '/', ''),
  events: events.length,
  reportOnly: true,
  selfCheck,
  baseline: { cutoffs: DEFAULT_CUTOFFS, precision: r3(base.precision), recall: r3(base.recall), fpRate: r3(base.fpRate), fired: base.fired },
  sensitivity: {
    perAxis,
    primarySwing: { axis: 'severity', note: 'decisive filter by design — large swing expected, not graded', ...primarySwing },
    secondarySwing: { axes: ['confidence', 'relevance'], ...secondarySwing },
    grid: { configs: 27, minPrecision: r3(gridMinPrec), maxFpRate: r3(gridMaxFp) },
    cliffTolerance: CLIFF_TOLERANCE,
    stability,
    stabilityNote: 'advisory, report-only — graded on secondary knobs; on N=20 it flags where to watch, it does not prove overfit',
  },
  walkForward: {
    framing: 'temporal stability (no fitted params) — not train/validate',
    split: '70/30 chronological',
    inSample: { n: isC.n, precision: r3(isC.precision), recall: r3(isC.recall), fpRate: r3(isC.fpRate) },
    outOfSample: { n: oosC.n, precision: r3(oosC.precision), recall: r3(oosC.recall), fpRate: r3(oosC.fpRate) },
    warning: oosWarning,
  },
  deferred,
}
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2))

// ── console summary ──
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
console.log(`=== ROBUSTNESS AUDIT (report-only) — ${report.dataDir} (${events.length} events) ===`)
console.log(`self-check: ${selfCheck.ok ? 'OK' : 'FAIL'} — ${selfCheck.note}`)
console.log(`baseline (${DEFAULT_CUTOFFS.severity}/${DEFAULT_CUTOFFS.confidence}/${DEFAULT_CUTOFFS.relevance}): precision=${pct(base.precision)} recall=${pct(base.recall)} fp-rate=${pct(base.fpRate)} fired=${base.fired}`)
console.log(`\n1. threshold-sensitivity sweep (perturb one cutoff ±1, hold others at default):`)
let curAxis = ''
for (const r of perAxis) {
  if (r.axis !== curAxis) {
    console.log(`  ${r.axis} cutoff:`)
    curAxis = r.axis
  }
  const mark = r.isBaseline ? ' (baseline)' : ''
  console.log(`    ${r.axis}=${(r.cutoffs as any)[r.axis]}: precision=${pct(r.precision)} recall=${pct(r.recall)} fp-rate=${pct(r.fpRate)} fired=${r.fired}${mark}`)
}
console.log(`  primary swing (severity — decisive by design, not graded): precision=${pct(primarySwing.precision)} recall=${pct(primarySwing.recall)} fp-rate=${pct(primarySwing.fpRate)}`)
console.log(`  secondary swing (confidence/relevance): precision=${pct(secondarySwing.precision)} recall=${pct(secondarySwing.recall)} fp-rate=${pct(secondarySwing.fpRate)}`)
console.log(`  full grid (27 configs): minPrecision=${pct(gridMinPrec)} maxFpRate=${pct(gridMaxFp)}`)
console.log(`  stability (advisory, graded on secondary knobs): ${stability.toUpperCase()} (max secondary swing ${pct(maxSecondarySwing)} vs tolerance ${pct(CLIFF_TOLERANCE)})`)
console.log(`\n2. walk-forward temporal split (70/30 chronological; temporal stability, NOT train/validate):`)
console.log(`  in-sample  (n=${isC.n}): precision=${pct(isC.precision)} recall=${pct(isC.recall)} fp-rate=${pct(isC.fpRate)}`)
console.log(`  out-sample (n=${oosC.n}): precision=${pct(oosC.precision)} recall=${pct(oosC.recall)} fp-rate=${pct(oosC.fpRate)}`)
if (oosWarning) console.log(`  ⚠ ${oosWarning}`)
console.log(`\n3. PBO / deflated Sharpe: DEFERRED — ${deferred.reason}`)
console.log(`\nreport.json -> ${resolve(OUT, 'report.json')}`)

// report-only: always exit 0 (even on self-check failure — surfaced in the report, not a gate)
process.exit(0)
