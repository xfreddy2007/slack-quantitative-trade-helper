/**
 * Tiered validation orchestrator — the single entrypoint for the evaluation suite.
 *
 *   npx tsx scripts/validate.ts <fast|full|deep>
 *
 * Runs the tier's steps IN ORDER, stops at the first hard failure (gate/infra),
 * prints a per-step pass/fail table, and writes scripts/out/validate-report.json.
 * Exit code = the first failing step's exit code (0 when all pass).
 *
 * Wires EXISTING commands only (typecheck / vitest / pytest / quality-gate /
 * backtest:fixtures / backtest-2025) — no new test logic lives here.
 *
 * e2e: `.claude/e2e-tests.md` via the `/e2e-test` skill stays AUTHORITATIVE for
 * full functional coverage. This orchestrator shells only a small CLI subset
 * (E2E subset below): the e2e checks that are pure-CLI, exit-code-verifiable, and
 * NOT already covered by the Fast lane. Most e2e cases reduce to vitest/pytest the
 * Fast lane already runs; the one genuinely additive check is T0.2 `prisma validate`.
 *
 * Tier spec: docs/evaluation/02-validation-tiers.md
 */
import { spawnSync } from 'child_process'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const SLACK_BOT_DIR = resolve(PROJECT_ROOT, 'apps/slack-bot')
const PY_DIR = resolve(PROJECT_ROOT, 'research/quant-python')
const COMPOSE = resolve(PROJECT_ROOT, 'docker-compose.yml')
const SCHEMA = resolve(PROJECT_ROOT, 'db/prisma/schema.prisma')
const OUT_DIR = resolve(__dirname, 'out')
const DEFAULT_DATABASE_URL = 'postgresql://investment:investment@localhost:5433/investment_helper'

type Tier = 'fast' | 'full' | 'deep'
type Kind = 'gate' | 'report' | 'infra'
type Status = 'pass' | 'fail' | 'warn' | 'skip'

interface Step {
  id: string
  name: string
  tiers: Tier[]
  /** gate: non-zero fails the run · report: never fails the run · infra: prerequisite, non-zero aborts */
  kind: Kind
  cmd?: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
  /** Custom executor (used for the multi-command Postgres bring-up). */
  run?: () => { exitCode: number; output: string }
  /** Not yet built — recorded as skip, never executed (e.g. robustness → §06). */
  todo?: boolean
}

interface StepResult {
  id: string
  name: string
  kind: Kind
  status: Status
  exitCode: number | null
  durationMs: number
  note?: string
}

// Load .env from the project root (NOT `export $(grep .env|xargs)` — that leaks the
// whole env). Children inherit DATABASE_URL etc. via process.env.
function loadEnv(): void {
  const envPath = resolve(PROJECT_ROOT, '.env')
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const eq = t.indexOf('=')
      const key = t.slice(0, eq).trim()
      if (key && !(key in process.env)) process.env[key] = t.slice(eq + 1).trim()
    }
  }
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = DEFAULT_DATABASE_URL
}

/** Bring up Postgres and apply migrations — mirrors e2e setup S2–S4 (docker-compose.yml). */
function bringUpPostgres(): { exitCode: number; output: string } {
  const log: string[] = []
  const up = spawnSync('docker', ['compose', '-f', COMPOSE, 'up', '-d', 'postgres'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
  })
  log.push(up.stdout ?? '', up.stderr ?? '')
  if (up.status !== 0) return { exitCode: up.status ?? 1, output: `${log.join('')}\ndocker compose up failed` }

  // Poll health for up to 60s (e2e S3).
  const deadline = Date.now() + 60_000
  let healthy = false
  while (Date.now() < deadline) {
    const ps = spawnSync('docker', ['compose', '-f', COMPOSE, 'ps', 'postgres'], {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    })
    if (/healthy/.test(ps.stdout ?? '')) {
      healthy = true
      break
    }
    spawnSync('sleep', ['2'])
  }
  if (!healthy) return { exitCode: 1, output: `${log.join('')}\npostgres did not become healthy within 60s` }

  // Apply migrations (e2e S4).
  const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema', SCHEMA], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
  })
  log.push(migrate.stdout ?? '', migrate.stderr ?? '')
  return { exitCode: migrate.status ?? 1, output: log.join('') }
}

// ─── Step inventory ───────────────────────────────────────────────────────────
// Order matters: steps run top-to-bottom; DB-dependent steps come after db-up.
const STEPS: Step[] = [
  {
    id: 'typecheck',
    name: 'TypeScript typecheck (tsc --noEmit)',
    tiers: ['fast', 'full', 'deep'],
    kind: 'gate',
    cmd: 'npm',
    args: ['--prefix', SLACK_BOT_DIR, 'run', 'typecheck'],
  },
  {
    id: 'ts-unit',
    name: 'TypeScript unit + integration (vitest; DB tests self-skip when no DB)',
    tiers: ['fast', 'full', 'deep'],
    kind: 'gate',
    cmd: 'npm',
    args: ['--prefix', SLACK_BOT_DIR, 'test'],
  },
  {
    id: 'py-unit',
    name: 'Python library tests (uv run pytest)',
    tiers: ['fast', 'full', 'deep'],
    kind: 'gate',
    cmd: 'uv',
    args: ['run', 'pytest'],
    cwd: PY_DIR,
  },
  {
    id: 'db-up',
    name: 'Bring up Postgres + migrate (e2e S2–S4)',
    tiers: ['full', 'deep'],
    kind: 'infra',
    run: bringUpPostgres,
  },
  {
    id: 'e2e-prisma-validate',
    name: 'e2e subset: Prisma schema validate (T0.2)',
    tiers: ['full', 'deep'],
    kind: 'gate',
    cmd: 'npx',
    args: ['prisma', 'validate', '--schema', SCHEMA],
    cwd: PROJECT_ROOT,
  },
  {
    id: 'quality-gate',
    name: 'Pipeline + render gate (quality-gate.ts; needs DB)',
    tiers: ['full', 'deep'],
    kind: 'gate',
    cmd: 'npm',
    args: ['run', 'quality-gate'],
    cwd: PROJECT_ROOT,
    timeoutMs: 300_000,
  },
  {
    id: 'backtest-gate',
    name: 'Signal-quality backtest FP-rate gate (backtest:fixtures)',
    tiers: ['full', 'deep'],
    kind: 'gate',
    cmd: 'npm',
    args: ['run', 'backtest:fixtures'],
    cwd: PROJECT_ROOT,
  },
  {
    id: 'backtest-report',
    name: 'Full-year backtest report (backtest-2025; regenerates report.json)',
    tiers: ['full', 'deep'],
    kind: 'report',
    cmd: 'npx',
    args: ['tsx', 'scripts/backtest-2025/run.ts'],
    cwd: PROJECT_ROOT,
  },
  {
    id: 'backtest-baseline',
    name: 'Signal-quality regression gate — 2025 set (assertBaseline, ratchet)',
    tiers: ['full', 'deep'],
    kind: 'gate',
    cmd: 'npx',
    args: ['tsx', 'scripts/assertBaseline.ts', '2025-full-year'],
    cwd: PROJECT_ROOT,
  },
  {
    id: 'backtest-30d',
    name: '30-day smoke backtest (regenerates 30d report.json)',
    tiers: ['deep'],
    kind: 'report',
    cmd: 'npx',
    args: ['tsx', 'scripts/backtest-2025/run.ts'],
    cwd: PROJECT_ROOT,
    env: { BT_DATA_DIR: resolve(PROJECT_ROOT, 'scripts/backtest-30d') },
  },
  {
    id: 'backtest-30d-baseline',
    name: 'Signal-quality regression gate — 30d smoke set (assertBaseline, ratchet)',
    tiers: ['deep'],
    kind: 'gate',
    cmd: 'npx',
    args: ['tsx', 'scripts/assertBaseline.ts', '30d-smoke'],
    cwd: PROJECT_ROOT,
  },
  {
    id: 'robustness',
    name: 'Robustness audit — sensitivity sweep + walk-forward (report-only)',
    tiers: ['deep'],
    kind: 'report',
    cmd: 'npx',
    args: ['tsx', 'scripts/robustness/run.ts'],
    cwd: PROJECT_ROOT,
  },
]

function runStep(step: Step): { exitCode: number | null; output: string } {
  if (step.run) return step.run()
  const res = spawnSync(step.cmd!, step.args ?? [], {
    cwd: step.cwd ?? PROJECT_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, ...step.env },
    timeout: step.timeoutMs ?? 120_000,
  })
  return { exitCode: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` }
}

const ICON: Record<Status, string> = { pass: '✅', fail: '❌', warn: '⚠️ ', skip: '⏭ ' }

function main(): void {
  const tier = process.argv[2] as Tier
  if (!['fast', 'full', 'deep'].includes(tier)) {
    console.error('Usage: npx tsx scripts/validate.ts <fast|full|deep>')
    process.exit(2)
  }

  loadEnv()
  mkdirSync(OUT_DIR, { recursive: true })

  const steps = STEPS.filter((s) => s.tiers.includes(tier))
  console.log(`\n[validate] tier=${tier} — ${steps.length} steps\n`)

  const results: StepResult[] = []
  let firstFailure: StepResult | null = null
  const startedAt = new Date().toISOString()
  const t0 = Date.now()

  for (const step of steps) {
    // Stop-on-first-hard-failure: once a gate/infra step failed, skip the rest.
    if (firstFailure) {
      results.push({ id: step.id, name: step.name, kind: step.kind, status: 'skip', exitCode: null, durationMs: 0, note: 'skipped after earlier failure' })
      console.log(`  ${ICON.skip} ${step.name} (skipped)`)
      continue
    }
    if (step.todo) {
      results.push({ id: step.id, name: step.name, kind: step.kind, status: 'skip', exitCode: null, durationMs: 0, note: 'TODO — see docs/evaluation/06' })
      console.log(`  ${ICON.skip} ${step.name} (TODO → §06)`)
      continue
    }

    console.log(`  … ${step.name}`)
    const st = Date.now()
    const { exitCode, output } = runStep(step)
    const durationMs = Date.now() - st
    const ok = exitCode === 0

    let status: Status
    if (ok) status = 'pass'
    else if (step.kind === 'report') status = 'warn' // report-only never fails the run
    else status = 'fail'

    const result: StepResult = { id: step.id, name: step.name, kind: step.kind, status, exitCode, durationMs }
    results.push(result)
    console.log(`  ${ICON[status]} ${step.name} (${(durationMs / 1000).toFixed(1)}s, exit ${exitCode})`)

    if (status === 'fail') {
      firstFailure = result
      // Surface the failing output tail for fast diagnosis.
      const tail = output.split('\n').slice(-25).join('\n')
      console.log(`\n──── ${step.id} output (tail) ────\n${tail}\n`)
    }
  }

  const durationMs = Date.now() - t0
  const overall: Status = firstFailure ? 'fail' : 'pass'

  // ─── Report ───
  const report = {
    tier,
    startedAt,
    durationMs,
    status: overall,
    firstFailure: firstFailure ? { id: firstFailure.id, exitCode: firstFailure.exitCode } : null,
    steps: results,
  }
  const reportPath = resolve(OUT_DIR, 'validate-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  // ─── Table ───
  console.log(`\n┌─ validate:${tier} ─ ${overall === 'pass' ? 'PASS' : 'FAIL'} ─ ${(durationMs / 1000).toFixed(1)}s`)
  for (const r of results) {
    const d = r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '—'
    console.log(`│ ${ICON[r.status]} ${r.id.padEnd(20)} ${String(d).padStart(7)}  ${r.note ?? ''}`)
  }
  console.log(`└─ report: ${reportPath}\n`)

  process.exit(firstFailure ? (firstFailure.exitCode ?? 1) : 0)
}

main()
