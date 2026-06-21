import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { NewsFixtureSchema } from '@schemas/zod/news-fixture'
import type { NormalizedNewsItem } from '../providers/adapter.js'
import { getPrismaClient, shutdown } from '../db/prismaClient.js'
import { SourceRepository } from '../db/sourceRepository.js'
import { TriggerRepository } from '../db/triggerRepository.js'
import { ingestItem } from './ingestFixtureSources.js'
import { classifyAll } from './marketClassifier.js'
import { deduplicate } from './deduplication.js'
import { scoreItem, TRIGGER_MODEL_VERSION } from './triggerScoring.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '../../../../')
const SCHEMA_VERSION = '1.0.0'

const DEFAULT_NEWS_FIXTURE_DIR = resolve(PROJECT_ROOT, 'packages/fixtures/news')
const DEFAULT_PORTFOLIO_FIXTURE = resolve(PROJECT_ROOT, 'packages/fixtures/portfolios/mixed.yaml')
const PYTHON_PROJECT_DIR = resolve(PROJECT_ROOT, 'research/quant-python')

// Load .env from project root — keeps script self-contained without dotenv dependency
const DOT_ENV_PATH = resolve(PROJECT_ROOT, '.env')
if (existsSync(DOT_ENV_PATH)) {
  for (const line of readFileSync(DOT_ENV_PATH, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const eq = t.indexOf('=')
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}

function flagValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : undefined
}

function loadNewsFixtures(dir: string): NormalizedNewsItem[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  const items: NormalizedNewsItem[] = []
  for (const file of files) {
    const raw: unknown = JSON.parse(readFileSync(resolve(dir, file), 'utf-8'))
    const parsed = NewsFixtureSchema.safeParse(raw)
    if (!parsed.success) {
      console.error(`SKIPPED malformed fixture ${file}: ${JSON.stringify(parsed.error.errors)}`)
      continue
    }
    items.push(parsed.data)
  }
  return items
}

function runDailyRecommendationJob(portfolioFixture: string): string {
  const result = spawnSync(
    'uv',
    [
      'run',
      'python',
      '-m',
      'investment_research.jobs.generate_daily_recommendations',
      '--fixture',
      portfolioFixture,
    ],
    { cwd: PYTHON_PROJECT_DIR, encoding: 'utf-8', env: process.env }
  )

  if (result.error) throw result.error
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    throw new Error(`generate_daily_recommendations exited with code ${result.status}`)
  }
  return result.stdout
}

interface RecommendationOutcome {
  dailyRecommendationId: string
  paperRecommendationIds: string[]
}

async function resolveOutcome(
  stdout: string,
  db: ReturnType<typeof getPrismaClient>
): Promise<RecommendationOutcome> {
  const createdMatch = stdout.match(
    /Created daily_recommendation:\s*(\S+?),\s*paper_recommendations:\s*\[([^\]]*)\]/
  )
  if (createdMatch) {
    const ids = [...createdMatch[2].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => (m[1] ?? m[2]) as string)
    return { dailyRecommendationId: createdMatch[1], paperRecommendationIds: ids }
  }

  const existingMatch = stdout.match(/Daily recommendation already exists for [^:]+:\s*(\S+)/)
  if (existingMatch) {
    const dailyRecommendationId = existingMatch[1]
    const daily = await db.dailyRecommendation.findUnique({ where: { id: dailyRecommendationId } })
    const papers = daily
      ? await db.paperRecommendation.findMany({ where: { portfolioSnapshotId: daily.portfolioSnapshotId } })
      : []
    return { dailyRecommendationId, paperRecommendationIds: papers.map((p) => p.id) }
  }

  throw new Error(`Could not parse daily recommendation job output: ${stdout}`)
}

async function main(): Promise<void> {
  const newsFixtureDir = flagValue('--news-dir') ?? DEFAULT_NEWS_FIXTURE_DIR
  const portfolioFixture = flagValue('--portfolio-fixture') ?? DEFAULT_PORTFOLIO_FIXTURE

  const db = getPrismaClient()
  const sourceRepo = new SourceRepository(db)
  const triggerRepo = new TriggerRepository(db)

  console.log('=== Stage 1-2: Ingest + classify fixture news ===')
  const rawItems = loadNewsFixtures(newsFixtureDir)
  const classified = classifyAll(rawItems)

  console.log('=== Stage 3: Deduplicate ===')
  const { kept, suppressed } = deduplicate(classified)
  for (const { item, reason } of suppressed) {
    console.log(`DEDUP-SUPPRESSED: ${item.source_url} (${reason})`)
  }

  for (const item of kept) {
    try {
      await ingestItem(sourceRepo, item)
    } catch (err) {
      console.error(`ERROR ingesting ${item.source_url}: ${err}`)
    }
  }

  console.log('=== Stage 4: Trigger scoring ===')
  for (const item of kept) {
    const priorSeverity = await triggerRepo.findPriorSeverity([item.source_url])
    const score = scoreItem(item, { priorSeverity })
    const { id, isNew } = await triggerRepo.upsertTriggerEvaluation(score, {
      modelVersion: TRIGGER_MODEL_VERSION,
      schemaVersion: SCHEMA_VERSION,
    })
    const status = isNew ? 'new' : 'duplicate (reused existing trigger_evaluation)'
    console.log(
      `TRIGGER: ${id} | ${item.title} | severity=${score.severity} confidence=${score.confidence} ` +
        `action=${score.suggestedAction} (${status})`
    )
  }

  console.log('=== Stage 5: Daily recommendation (Python job) ===')
  const stdout = runDailyRecommendationJob(portfolioFixture)
  const outcome = await resolveOutcome(stdout, db)

  console.log(`daily_recommendation_id: ${outcome.dailyRecommendationId}`)
  for (const id of outcome.paperRecommendationIds) {
    console.log(`paper_recommendation_id: ${id}`)
  }

  await shutdown()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
