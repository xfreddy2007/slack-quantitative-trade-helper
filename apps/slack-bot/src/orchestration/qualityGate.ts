import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { spawnSync } from 'child_process'
import { getPrismaClient, shutdown } from '../db/prismaClient.js'
import { buildRecommendationTodayMessage } from '../slack/commands/recommendationToday.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SLACK_BOT_DIR = resolve(__dirname, '../..')
const PROJECT_ROOT = resolve(SLACK_BOT_DIR, '../..')

/** Daily-recommendation render sections that must always be present (PRD Section 12). */
export const REQUIRED_SECTIONS = ['今日觀察', '可考慮調整', '不建議動作'] as const

/** A quality-gate failure tagged with the pipeline step that failed, for fast diagnosis. */
export class QualityGateError extends Error {
  constructor(
    readonly step: string,
    message: string
  ) {
    super(message)
    this.name = 'QualityGateError'
  }
}

export interface PipelineOutput {
  dailyRecommendationId: string | null
  paperRecommendationIds: string[]
}

export function parsePipelineOutput(stdout: string): PipelineOutput {
  const daily = stdout.match(/daily_recommendation_id:\s*(\S+)/)
  const papers = [...stdout.matchAll(/paper_recommendation_id:\s*(\S+)/g)].map((m) => m[1])
  return { dailyRecommendationId: daily ? daily[1] : null, paperRecommendationIds: papers }
}

/** Throw a QualityGateError naming the first missing section; return true when all are present. */
export function assertRequiredSections(rendered: string): true {
  const missing = REQUIRED_SECTIONS.filter((s) => !rendered.includes(s))
  if (missing.length > 0) {
    throw new QualityGateError('render', `Slack render missing required section(s): ${missing.join(', ')}`)
  }
  return true
}

// Load .env from the project root so the gate's own DB queries have DATABASE_URL.
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

async function main(): Promise<void> {
  loadEnv()

  // Step 1 — run the full fixture pipeline.
  console.log('[quality-gate] Step 1/3: running fixture pipeline …')
  const pipeline = spawnSync('npm', ['run', 'pipeline:fixture'], {
    cwd: SLACK_BOT_DIR,
    encoding: 'utf-8',
  })
  const out = `${pipeline.stdout ?? ''}${pipeline.stderr ?? ''}`
  if (pipeline.status !== 0) {
    throw new QualityGateError('pipeline', `fixture pipeline exited ${pipeline.status}\n${out}`)
  }

  // Step 2 — assert the pipeline created the expected records.
  console.log('[quality-gate] Step 2/3: asserting created records …')
  const { dailyRecommendationId, paperRecommendationIds } = parsePipelineOutput(out)
  if (!dailyRecommendationId) {
    throw new QualityGateError('records', 'no daily_recommendation was created by the pipeline')
  }
  if (paperRecommendationIds.length < 1) {
    throw new QualityGateError('records', 'no paper_recommendation was created by the pipeline')
  }

  // Step 3 — assert the Slack render contains all required sections.
  console.log('[quality-gate] Step 3/3: asserting Slack render sections …')
  const db = getPrismaClient()
  const rendered = await buildRecommendationTodayMessage(db)
  assertRequiredSections(rendered)

  console.log('[quality-gate] ✅ PASS')
  console.log(`  daily_recommendation: ${dailyRecommendationId}`)
  console.log(`  paper_recommendations: ${paperRecommendationIds.length}`)
  console.log(`  sections: ${REQUIRED_SECTIONS.join(', ')}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then(() => shutdown())
    .then(() => process.exit(0))
    .catch(async (err) => {
      await shutdown().catch(() => undefined)
      if (err instanceof QualityGateError) {
        console.error(`[quality-gate] ❌ FAILED at step "${err.step}": ${err.message}`)
      } else {
        console.error(`[quality-gate] ❌ FAILED: ${err instanceof Error ? err.message : String(err)}`)
      }
      process.exit(1)
    })
}
