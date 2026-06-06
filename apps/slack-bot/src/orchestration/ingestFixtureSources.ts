import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { NewsFixtureSchema } from '@schemas/zod/news-fixture'
import type { z } from 'zod'
import { getPrismaClient, shutdown } from '../db/client.js'
import { SourceRepository } from '../db/sourceRepository.js'
import { writeRawSource } from './rawSourceWriter.js'
import { writeWikiPage, appendToLog, updateIndex } from './wikiWriter.js'
import { classifyMarket } from './marketClassifier.js'
import type { WikiFrontmatter } from './wikiWriter.js'

type NewsItem = z.infer<typeof NewsFixtureSchema>

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '../../../../')

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

async function ingestItem(repo: SourceRepository, item: NewsItem): Promise<void> {
  const market = classifyMarket(item)

  const { sourceId, isNew } = await repo.upsertSource({
    provider: item.provider ?? 'fixture',
    url: item.source_url,
    title: item.title,
    publishedAt: new Date(item.published_at),
    author: item.author ?? undefined,
    content: item.content,
    contentType: 'text/plain',
  })

  if (!isNew) {
    console.log(`SUPPRESSED: ${item.source_url} (duplicate)`)
    return
  }

  const rawPath = writeRawSource(sourceId, item.content, {
    title: item.title,
    url: item.source_url,
    provider: item.provider ?? 'fixture',
    publishedAt: new Date(item.published_at),
  })

  await repo.setRawPath(sourceId, rawPath)

  const riskTags = item.expected_tags ?? (market === 'GLOBAL' ? ['geopolitical'] : [])

  const db = getPrismaClient()
  await db.newsAnalysis.create({
    data: {
      sourceId,
      summary: item.content.slice(0, 200),
      tickers: [],
      topics: [],
      riskTags,
      assetClasses: [],
      severity: item.expected_severity ?? 1,
      confidence: item.expected_confidence ?? 3,
      market,
    },
  })

  const fm: WikiFrontmatter = {
    title: item.title,
    type: 'news',
    date: new Date(item.published_at),
    sourceCount: 1,
    tickers: [],
    markets: [market],
    assetClasses: [],
    riskTags,
    confidence: 'medium',
    lastUpdated: new Date(),
  }
  writeWikiPage(sourceId, fm)
  appendToLog(sourceId, item.title)
  updateIndex(sourceId, item.title, market)

  console.log(`INGESTED: ${sourceId} | ${market} | ${item.title}`)
}

async function main(): Promise<void> {
  const fixtureIdx = process.argv.indexOf('--fixture')
  if (fixtureIdx === -1 || !process.argv[fixtureIdx + 1]) {
    console.error('Usage: ingestFixtureSources.ts --fixture <path>')
    process.exit(1)
  }

  const fixturePath = resolve(PROJECT_ROOT, process.argv[fixtureIdx + 1])
  const raw: unknown = JSON.parse(readFileSync(fixturePath, 'utf-8'))
  const items: unknown[] = Array.isArray(raw) ? raw : [raw]

  const db = getPrismaClient()
  const repo = new SourceRepository(db)

  for (const rawItem of items) {
    const parsed = NewsFixtureSchema.safeParse(rawItem)
    if (!parsed.success) {
      console.error(`SKIPPED malformed item: ${JSON.stringify(parsed.error.errors)}`)
      continue
    }
    try {
      await ingestItem(repo, parsed.data)
    } catch (err) {
      console.error(`ERROR ingesting ${(rawItem as Record<string, unknown>)?.source_url ?? 'unknown'}: ${err}`)
    }
  }

  await shutdown()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
