/**
 * Signal-quality regression gate (ratchet).
 *
 *   npx tsx scripts/assertBaseline.ts <set-key>
 *   # e.g.  npx tsx scripts/assertBaseline.ts 2025-full-year
 *
 * Reads docs/evaluation/baselines.json (the registry) + the set's report.json,
 * then asserts every gated metric is "no worse than baseline +/- epsilon" for its
 * direction. Exit 0 = all within tolerance, exit 1 = a regression crossed a floor.
 *
 * Policy is RATCHET, not a hard floor: a change may not push a gated metric past
 * baseline - epsilon (higher-is-better) or baseline + epsilon (lower-is-better).
 * Epsilon absorbs small-sample noise; lowering a baseline is an explicit reviewed
 * edit to baselines.json (see docs/evaluation/08-quality-gates-and-baselines.md).
 *
 * Spec: docs/evaluation/04-signal-quality-evaluation.md
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const REGISTRY = resolve(PROJECT_ROOT, 'docs/evaluation/baselines.json')

type Direction = 'higher' | 'lower'
interface MetricSpec {
  path: string
  baseline: number
  direction: Direction
  epsilon: number
  gated: boolean
}
interface SetSpec {
  report: string
  events: number
  metrics: Record<string, MetricSpec>
}
interface Registry {
  version: number
  sets: Record<string, SetSpec>
}

/** Resolve a dotted path (e.g. "totals.precision") against a report object. */
function dig(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc == null ? acc : (acc as Record<string, unknown>)[k]), obj)
}

/** The ratchet floor/ceiling for a metric, given its direction. */
function bound(m: MetricSpec): number {
  return m.direction === 'higher' ? m.baseline - m.epsilon : m.baseline + m.epsilon
}

/** Did `actual` regress past the bound for this direction? */
function regressed(actual: number, m: MetricSpec): boolean {
  return m.direction === 'higher' ? actual < bound(m) : actual > bound(m)
}

interface Check {
  metric: string
  actual: number | null
  baseline: number
  bound: number
  direction: Direction
  ok: boolean
  note: string
}

function main(): void {
  const setKey = process.argv[2]
  if (!setKey) {
    console.error('Usage: npx tsx scripts/assertBaseline.ts <set-key>')
    process.exit(2)
  }

  const registry: Registry = JSON.parse(readFileSync(REGISTRY, 'utf-8'))
  const set = registry.sets[setKey]
  if (!set) {
    console.error(`Unknown baseline set "${setKey}". Known: ${Object.keys(registry.sets).join(', ')}`)
    process.exit(2)
  }

  const reportPath = resolve(PROJECT_ROOT, set.report)
  let report: unknown
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf-8'))
  } catch {
    console.error(`Cannot read report for "${setKey}" at ${reportPath} — run the backtest first.`)
    process.exit(2)
  }

  const checks: Check[] = []
  for (const [metric, spec] of Object.entries(set.metrics)) {
    if (!spec.gated) continue
    const raw = dig(report, spec.path)
    const actual = typeof raw === 'number' ? raw : null
    if (actual == null) {
      checks.push({ metric, actual: null, baseline: spec.baseline, bound: bound(spec), direction: spec.direction, ok: false, note: `missing at ${spec.path}` })
      continue
    }
    const ok = !regressed(actual, spec)
    const cmp = spec.direction === 'higher' ? '>=' : '<='
    checks.push({ metric, actual, baseline: spec.baseline, bound: bound(spec), direction: spec.direction, ok, note: `need ${cmp} ${bound(spec).toFixed(3)} (base ${spec.baseline} +/- ${spec.epsilon})` })
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n[assertBaseline] set=${setKey} (${set.events} events) — ${checks.length} gated metrics`)
  for (const c of checks) {
    const icon = c.ok ? 'PASS' : 'FAIL'
    const got = c.actual == null ? '—' : c.actual.toFixed(3)
    console.log(`  ${icon}  ${c.metric.padEnd(26)} actual=${got.padStart(7)}  ${c.note}`)
  }
  if (failed.length) {
    console.log(`\n[assertBaseline] FAIL — ${failed.length} metric(s) regressed past tolerance:`)
    for (const c of failed) console.log(`  - ${c.metric}: ${c.actual == null ? 'missing' : c.actual.toFixed(3)} vs ${c.note}`)
    console.log(`  If this is an intended/justified change, edit ${REGISTRY} with a rationale (see docs/evaluation/08).`)
    process.exit(1)
  }
  console.log(`[assertBaseline] PASS — all gated metrics within ratchet tolerance.\n`)
  process.exit(0)
}

main()
