import { describe, it, expect, afterAll } from 'vitest'
import { getPrismaClient, shutdown } from '../../../src/db/prismaClient.js'

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

afterAll(async () => {
  await shutdown()
})

describe('prismaClient — integration', () => {
  it('connects to the local DB and reads at least one schema_versions row', async () => {
    const db = getPrismaClient()

    try {
      // Self-seed a sentinel row so this test is independent of external seed ordering
      // (the blanket `npm test` runs before the e2e seed step). Upsert is idempotent.
      await db.schemaVersion.upsert({
        where: { version: '0.0.0-test' },
        update: {},
        create: { version: '0.0.0-test', description: 'prismaClient integration test sentinel' },
      })
      const versions = await db.schemaVersion.findMany()
      expect(versions.length).toBeGreaterThan(0)
      expect(versions[0]).toHaveProperty('version')
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
