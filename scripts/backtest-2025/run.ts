/**
 * 2025 full-year confidence-quality backtest.
 *
 * Reuses the LIVE app judgment logic (scoreItem / checkThreshold / checkBudget)
 * against curated real-2025 events + reconstructed real-2025 price paths, then
 * validates the app's confidence against actual forward market outcomes.
 *
 * Run: npx tsx scripts/backtest-2025/run.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { scoreItem } from '../../apps/slack-bot/src/orchestration/triggerScoring.js'
import { checkThreshold } from '../../apps/slack-bot/src/orchestration/alertThreshold.js'
import {
  emptyBudget,
  checkBudget,
  incrementBudget,
  type DayBudget,
  type AlertMarket,
} from '../../apps/slack-bot/src/orchestration/alertBudget.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Window-agnostic: point at any data dir / horizons via env (defaults = 2025 full-year run).
const DATA_DIR = process.env.BT_DATA_DIR ? resolve(process.env.BT_DATA_DIR) : __dirname
const OUT = resolve(DATA_DIR, 'out')
const HORIZONS = (process.env.BT_HORIZONS ?? '5,21,63').split(',').map((s) => Number(s.trim()))
const ADVERSE_HORIZON = Number(process.env.BT_ADVERSE_HORIZON ?? '21')
// T4: acute shocks are judged short (5d); allocation drift keeps the long (21d) window.
const ACUTE_HORIZON = Number(process.env.BT_ACUTE_HORIZON ?? '5')
const ALLOC_HORIZON = Number(process.env.BT_ALLOC_HORIZON ?? String(ADVERSE_HORIZON))
const LABEL = process.env.BT_LABEL ?? '2025 full-year'

// ---- data ----
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
interface PricePt { date: string; price: number }

const events: Ev[] = JSON.parse(readFileSync(resolve(DATA_DIR, 'events.json'), 'utf8'))
const pricesDoc = JSON.parse(readFileSync(resolve(DATA_DIR, 'prices.json'), 'utf8'))
const series: Record<string, PricePt[]> = pricesDoc.series

events.sort((a, b) => a.date.localeCompare(b.date))

// ---- price helpers ----
function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** nearest price on-or-after target; if none, last available (clamped). */
function priceOnOrAfter(sym: string, target: string): { price: number; clamped: boolean } | null {
  const s = series[sym]
  if (!s) return null
  for (const p of s) if (p.date >= target) return { price: p.price, clamped: false }
  return { price: s[s.length - 1].price, clamped: true }
}
function priceAt(sym: string, date: string): number | null {
  const r = priceOnOrAfter(sym, date)
  return r ? r.price : null
}
function fwdReturn(sym: string, from: string, days: number): { ret: number; clamped: boolean } | null {
  const p0 = priceOnOrAfter(sym, from)
  const p1 = priceOnOrAfter(sym, addDays(from, days))
  if (!p0 || !p1) return null
  return { ret: (p1.price - p0.price) / p0.price, clamped: p1.clamped }
}

// ---- run app judgment chronologically with daily budget ----
const ADVERSE_THRESHOLD = -0.05 // a materially adverse move = relevant holding down >5% within ADVERSE_HORIZON

interface Outcome {
  ev: Ev
  severity: number
  confidence: number
  relevance: number
  polarity: string
  adverseLikelihood: number
  evalHorizonClass: string
  suggestedAction: string
  decision: 'post' | 'suppress'
  fired: boolean
  budgetSuppressed: boolean
  classification: 'TP' | 'FP' | 'TN' | 'FN'
  fwd: Record<number, { ret: number; clamped: boolean } | null>
  evalHorizon: number // class-appropriate horizon used for ground-truth adverse check
  adverse: boolean // ground truth: relevant holding down >5% within the class-appropriate horizon
}

const budgets: Record<string, DayBudget> = {}
const outcomes: Outcome[] = []

for (const ev of events) {
  const score = scoreItem(ev as any)
  const th = checkThreshold(score.severity, score.confidence, score.relevance)
  let fired = false
  let budgetSuppressed = false
  if (th.decision === 'post') {
    const mkt = (ev.market === 'US' ? 'US' : ev.market === 'TW' ? 'TW' : 'GLOBAL') as AlertMarket
    const b = budgets[ev.date] ?? emptyBudget()
    const bud = checkBudget(b, mkt, score.severity)
    if (bud.decision === 'post') {
      fired = true
      budgets[ev.date] = incrementBudget(b, mkt)
    } else {
      budgetSuppressed = true
      budgets[ev.date] = b
    }
  }

  const fwd: Outcome['fwd'] = {}
  const wantHorizons = new Set([...HORIZONS, ACUTE_HORIZON, ALLOC_HORIZON])
  for (const h of wantHorizons) fwd[h] = fwdReturn(ev.relevant_symbol, ev.date, h)
  // T4: pick the ground-truth window by the event's evaluation class.
  const evalHorizon = score.evalHorizonClass === 'acute' ? ACUTE_HORIZON : ALLOC_HORIZON
  const rAdv = fwd[evalHorizon]
  const adverse = rAdv ? rAdv.ret <= ADVERSE_THRESHOLD : false

  const classification = fired
    ? ev.expected_alert ? 'TP' : 'FP'
    : ev.expected_alert ? 'FN' : 'TN'

  outcomes.push({
    ev, severity: score.severity, confidence: score.confidence, relevance: score.relevance,
    polarity: score.polarity, adverseLikelihood: score.adverseLikelihood,
    evalHorizonClass: score.evalHorizonClass,
    suggestedAction: score.suggestedAction, decision: th.decision, fired, budgetSuppressed,
    classification, fwd, evalHorizon, adverse,
  })
}

// ---- confusion matrix vs ground-truth expected_alert ----
const TP = outcomes.filter((o) => o.classification === 'TP').length
const FP = outcomes.filter((o) => o.classification === 'FP').length
const TN = outcomes.filter((o) => o.classification === 'TN').length
const FN = outcomes.filter((o) => o.classification === 'FN').length
const fired = outcomes.filter((o) => o.fired)
const precision = TP + FP ? TP / (TP + FP) : 0
const recall = TP + FN ? TP / (TP + FN) : 0
const fpRate = fired.length ? FP / fired.length : 0

// ---- adverse-likelihood calibration vs real adverse outcomes ----
// T3: predictedProb(adverse) = score.adverseLikelihood (NOT confidence — confidence is source reliability).
// Buckets keyed by rounded predicted probability so calibration shows discrimination across levels.
const calBuckets: Record<string, { n: number; adverse: number; predicted: number }> = {}
let brierSum = 0
let brierN = 0
for (const o of outcomes) {
  const p = o.adverseLikelihood
  const key = p.toFixed(2)
  calBuckets[key] = calBuckets[key] ?? { n: 0, adverse: 0, predicted: p }
  calBuckets[key].n++
  if (o.adverse) calBuckets[key].adverse++
  brierSum += (p - (o.adverse ? 1 : 0)) ** 2
  brierN++
}
const brier = brierN ? brierSum / brierN : 0

// T3: confidence is reliability — report its distribution to confirm it is graduated (not just {1,3}).
const confDist: Record<number, number> = {}
for (const o of outcomes) confDist[o.confidence] = (confDist[o.confidence] ?? 0) + 1
const distinctConfLevels = Object.keys(confDist).length

// ---- Information Coefficient (§04): graded predictive power, complements binary precision/recall ----
// Spearman rank-corr of the model's adverseLikelihood vs the realized adverse magnitude (-ret@evalHorizon).
// Positive IC = higher predicted adverse-likelihood ranks with worse realized outcomes (good discrimination).
// REPORT-ONLY for now — observe its stable range before gating (see baselines.json / §04).
function rank(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0])
  const r = new Array(xs.length).fill(0)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const avg = (i + j) / 2 + 1 // 1-based average rank for ties
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg
    i = j + 1
  }
  return r
}
function pearson(a: number[], b: number[]): number {
  const n = a.length
  if (n < 2) return 0
  const ma = a.reduce((x, y) => x + y, 0) / n
  const mb = b.reduce((x, y) => x + y, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}
const icPairs = outcomes
  .map((o) => ({ p: o.adverseLikelihood, r: o.fwd[o.evalHorizon]?.ret }))
  .filter((x): x is { p: number; r: number } => typeof x.r === 'number')
const icSpearman = icPairs.length >= 2 ? pearson(rank(icPairs.map((x) => x.p)), rank(icPairs.map((x) => -x.r))) : 0

// ---- per-category hit-rate (of FIRED alerts, did adverse move actually materialize) ----
const catStats: Record<string, { fired: number; adverse: number }> = {}
for (const o of fired) {
  const k = o.ev.category
  catStats[k] = catStats[k] ?? { fired: 0, adverse: 0 }
  catStats[k].fired++
  if (o.adverse) catStats[k].adverse++
}

// ---- per evalHorizonClass adverse-rate (T4: acute judged @5d, allocation @21d) ----
const classStats: Record<string, { n: number; adverse: number; horizon: number }> = {}
for (const o of outcomes) {
  const k = o.evalHorizonClass
  classStats[k] = classStats[k] ?? { n: 0, adverse: 0, horizon: o.evalHorizon }
  classStats[k].n++
  if (o.adverse) classStats[k].adverse++
}

// ---- acted signals: reduce_position AND fired => "act" (trim relevant holding) ----
// T4: drawdown avoided measured on the event's class-appropriate horizon (acute @5d, allocation @21d).
const acted = fired.filter((o) => o.suggestedAction === 'reduce_position')
const avoidedReturns = acted.map((o) => -(o.fwd[o.evalHorizon]?.ret ?? 0)) // positive = loss avoided
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const std = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}
const avoidedMean = mean(avoidedReturns)
const avoidedStd = std(avoidedReturns)
const actedSharpe = avoidedStd ? avoidedMean / avoidedStd : 0
const totalDrawdownAvoided = avoidedReturns.filter((r) => r > 0).reduce((a, b) => a + b, 0)
const actedHelped = avoidedReturns.filter((r) => r > 0).length
const actedHurt = avoidedReturns.filter((r) => r < 0).length

// ---- allocation-weighted portfolio index (mixed: 40 US / 30 TW-etf / 10 TW-indiv / 20 cash) ----
const W = { VOO: 0.40, '0050.TW': 0.30, '2330.TW': 0.10, cash: 0.20 }
// Timeline buckets: monthly for long windows, per-event-date for short (<=45d) windows.
const allDates = events.map((e) => e.date).sort()
const firstDate = allDates[0]
const lastDate = allDates[allDates.length - 1]
const spanDays = (new Date(lastDate + 'T00:00:00Z').getTime() - new Date(firstDate + 'T00:00:00Z').getTime()) / 86_400_000
const daily = spanDays <= 45
const base = {
  VOO: priceAt('VOO', firstDate)!, '0050.TW': priceAt('0050.TW', firstDate)!,
  '2330.TW': priceAt('2330.TW', firstDate)!, cash: 1,
}
function portIndex(date: string): number {
  let v = 0
  for (const s of Object.keys(W) as (keyof typeof W)[]) {
    const p = priceAt(s, date)
    if (p == null) continue
    v += W[s] * (p / (base as any)[s]) * 100
  }
  return v
}
const buckets = daily
  ? [...new Set(allDates)]
  : [...new Set(allDates.map((d) => d.slice(0, 7)))].map((m) => `${m}-28`)
const timeline = buckets.map((d) => {
  const key = daily ? d : d.slice(0, 7)
  const evs = outcomes.filter((o) => (daily ? o.ev.date === key : o.ev.date.slice(0, 7) === key))
  return {
    bucket: daily ? d : d.slice(0, 7),
    portIndex: portIndex(d),
    events: evs.length,
    alerts: evs.filter((o) => o.fired).length,
    suppressed: evs.filter((o) => !o.fired).length,
  }
})

// ---- write report ----
mkdirSync(OUT, { recursive: true })
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

const report = {
  model: 'trigger-scoring-v2 (live app logic)',
  label: LABEL,
  period: `${firstDate} .. ${lastDate}`,
  portfolio: 'mixed (VOO 40 / 0050.TW 30 / 2330.TW 10 / cash 20)',
  horizons: HORIZONS,
  adverseHorizon: ADVERSE_HORIZON,
  evalHorizonsByClass: { acute: ACUTE_HORIZON, allocation: ALLOC_HORIZON },
  totals: { events: outcomes.length, fired: fired.length, TP, FP, TN, FN, precision, recall, fpRate },
  // T3: calibration of the adverse-likelihood field (reliability-confidence is NOT used here).
  calibration: Object.fromEntries(
    Object.entries(calBuckets).map(([k, v]) => [k, { n: v.n, adverseRate: v.adverse / v.n, predicted: v.predicted }])
  ),
  brier,
  // §04: Information Coefficient — report-only (no gate yet); observe range before gating.
  ic: {
    method: 'spearman(adverseLikelihood, -ret@evalHorizon)',
    spearman: icSpearman,
    n: icPairs.length,
    note: 'positive = higher predicted adverse-likelihood ranks with worse realized outcome',
  },
  // T3: confidence (source reliability) distribution — must be graduated, not just {1,3}.
  confidenceDistribution: confDist,
  distinctConfidenceLevels: distinctConfLevels,
  // T4: adverse-rate measured per evaluation-horizon class.
  adverseByHorizonClass: Object.fromEntries(
    Object.entries(classStats).map(([k, v]) => [k, { n: v.n, horizon: v.horizon, adverseRate: v.adverse / v.n }])
  ),
  perCategory: Object.fromEntries(
    Object.entries(catStats).map(([k, v]) => [k, { fired: v.fired, adverseRate: v.adverse / v.fired }])
  ),
  actedSignals: {
    n: acted.length, helped: actedHelped, hurt: actedHurt,
    avgDrawdownAvoided: avoidedMean, totalDrawdownAvoided, sharpe: actedSharpe,
  },
  timeline,
  outcomes: outcomes.map((o) => ({
    id: o.ev.id, date: o.ev.date, cat: o.ev.category, mkt: o.ev.market,
    sev: o.severity, conf: o.confidence, rel: o.relevance,
    polarity: o.polarity, adverseLikelihood: o.adverseLikelihood, evalClass: o.evalHorizonClass,
    action: o.suggestedAction,
    decision: o.decision, fired: o.fired, budgetSuppressed: o.budgetSuppressed,
    class: o.classification, sym: o.ev.relevant_symbol,
    rets: Object.fromEntries(HORIZONS.map((h) => [h, o.fwd[h]?.ret ?? null])),
    evalHorizon: o.evalHorizon, adverse: o.adverse,
  })),
}
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2))

// ---- console summary ----
console.log(`=== CONFIDENCE-QUALITY BACKTEST: ${LABEL} (${firstDate}..${lastDate}) ===`)
console.log(`horizons=${HORIZONS.join('/')}d adverse@${ADVERSE_HORIZON}d`)
console.log(`events=${outcomes.length} fired=${fired.length} TP=${TP} FP=${FP} TN=${TN} FN=${FN}`)
console.log(`precision=${pct(precision)} recall=${pct(recall)} fp-rate=${pct(fpRate)} Brier(adverseLikelihood)=${brier.toFixed(3)}`)
console.log(`confidence (reliability) distribution: ${Object.entries(confDist).sort().map(([c, n]) => `${c}:${n}`).join(' ')} (${distinctConfLevels} distinct levels)`)
console.log(`IC (spearman adverseLikelihood vs -ret@evalHorizon): ${icSpearman.toFixed(3)} (n=${icPairs.length}, report-only)`)
console.log(`adverse-likelihood calibration (predicted -> realized):`)
for (const [k, v] of Object.entries(report.calibration).sort()) console.log(`  p=${pct((v as any).predicted)}: n=${(v as any).n} realized=${pct((v as any).adverseRate)}`)
console.log(`adverse-rate by eval-horizon class:`)
for (const [k, v] of Object.entries(report.adverseByHorizonClass)) console.log(`  ${k} @${(v as any).horizon}d: n=${(v as any).n} adverseRate=${pct((v as any).adverseRate)}`)
const acuteShocks = outcomes.filter((o) => o.evalHorizonClass === 'acute')
console.log(`acute shocks (judged @${ACUTE_HORIZON}d): ${acuteShocks.map((o) => `${o.ev.id}=${pct(o.fwd[ACUTE_HORIZON]?.ret ?? 0)}`).join(' ')}`)
console.log(`acted signals=${acted.length} helped=${actedHelped} hurt=${actedHurt} avgDrawdownAvoided=${pct(avoidedMean)} sharpe=${actedSharpe.toFixed(2)}`)
const first = timeline[0], last = timeline[timeline.length - 1]
console.log(`portfolio index ${first.bucket}->${last.bucket}: ${first.portIndex.toFixed(1)} -> ${last.portIndex.toFixed(1)} (${pct(last.portIndex/first.portIndex - 1)})`)
console.log(`report.json -> ${resolve(OUT, 'report.json')}`)
