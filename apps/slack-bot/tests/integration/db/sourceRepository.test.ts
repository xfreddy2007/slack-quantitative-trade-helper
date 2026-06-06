import { describe, it, expect, afterAll } from 'vitest'
import { SourceRepository, computeUrlHash } from '../../../src/db/sourceRepository.js'
import { getPrismaClient, shutdown } from '../../../src/db/client.js'

const SKIP_PATTERNS = [
  'ECONNREFUSED',
  'P1001',
  'P1013',
  'DATABASE_URL',
  "Can't reach database server",
]

function isDbUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return SKIP_PATTERNS.some((p) => msg.includes(p))
}

const TEST_URL = 'https://test.example.com/t321-source-repo-test'
const TEST_HASH = computeUrlHash(TEST_URL)

afterAll(async () => {
  const db = getPrismaClient()
  try {
    await db.sourceDocument.deleteMany({ where: { source: { url: TEST_URL } } })
    await db.source.deleteMany({ where: { url: TEST_URL } })
  } catch {
    // best-effort cleanup
  }
  await shutdown()
})

describe('SourceRepository — integration', () => {
  it('persists provider_run, source, and source_document; reads back matching row', async () => {
    const db = getPrismaClient()
    const repo = new SourceRepository(db)

    try {
      const providerRunId = await repo.createProviderRun('fixture')
      expect(typeof providerRunId).toBe('string')

      const { sourceId, isNew } = await repo.upsertSource({
        provider: 'fixture',
        url: TEST_URL,
        title: 'Test Article',
        content: 'Test content body',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      })

      expect(typeof sourceId).toBe('string')
      expect(isNew).toBe(true)

      const source = await db.source.findUnique({
        where: { id: sourceId },
        include: { documents: true },
      })
      expect(source).not.toBeNull()
      expect(source!.url).toBe(TEST_URL)
      expect(source!.hash).toBe(TEST_HASH)
      expect(source!.documents).toHaveLength(1)
      expect(source!.documents[0].content).toBe('Test content body')

      const run = await db.providerRun.findUnique({ where: { id: providerRunId } })
      expect(run).not.toBeNull()
      expect(run!.provider).toBe('fixture')

      await repo.completeProviderRun(providerRunId, { status: 'success', requestCount: 1 })
      const completed = await db.providerRun.findUnique({ where: { id: providerRunId } })
      expect(completed!.status).toBe('success')
      expect(completed!.completedAt).not.toBeNull()
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })

  it('upsertSource is idempotent — same URL returns same sourceId with isNew=false', async () => {
    const db = getPrismaClient()
    const repo = new SourceRepository(db)

    try {
      const r1 = await repo.upsertSource({
        provider: 'fixture',
        url: TEST_URL,
        title: 'Test Article',
        content: 'Test content body',
      })
      const r2 = await repo.upsertSource({
        provider: 'fixture',
        url: TEST_URL,
        title: 'Test Article',
        content: 'Test content body',
      })

      expect(r2.isNew).toBe(false)
      expect(r2.sourceId).toBe(r1.sourceId)

      const count = await db.source.count({ where: { hash: TEST_HASH } })
      expect(count).toBe(1)
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })

  it('setRawPath updates source.rawPath', async () => {
    const db = getPrismaClient()
    const repo = new SourceRepository(db)

    try {
      const { sourceId } = await repo.upsertSource({
        provider: 'fixture',
        url: TEST_URL,
        title: 'Test Article',
        content: 'Test content body',
      })

      await repo.setRawPath(sourceId, '/knowledge/raw/news/test.md')
      const source = await db.source.findUnique({ where: { id: sourceId } })
      expect(source!.rawPath).toBe('/knowledge/raw/news/test.md')
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })
})
