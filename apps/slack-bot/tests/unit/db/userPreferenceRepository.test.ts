import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { UserPreferenceRepository } from '../../../src/db/userPreferenceRepository.js'
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

const TEST_TARGETS = ['AAPL', 'OTHER_TYPE_TARGET']

afterEach(async () => {
  const db = getPrismaClient()
  try {
    await db.userPreference.deleteMany({ where: { target: { in: TEST_TARGETS } } })
  } catch {
    // best-effort cleanup
  }
})

afterAll(async () => {
  await shutdown()
})

describe('db/userPreferenceRepository', () => {
  it('mute creates a row with type=mute and the given target', async () => {
    const db = getPrismaClient()

    try {
      const repo = new UserPreferenceRepository(db)
      const pref = await repo.mute('AAPL')

      expect(pref.type).toBe('mute')
      expect(pref.target).toBe('AAPL')

      const rows = await db.userPreference.findMany({ where: { type: 'mute', target: 'AAPL' } })
      expect(rows).toHaveLength(1)
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

  it('mute is idempotent — calling twice results in only one row', async () => {
    const db = getPrismaClient()

    try {
      const repo = new UserPreferenceRepository(db)
      await repo.mute('AAPL')
      await repo.mute('AAPL')

      const rows = await db.userPreference.findMany({ where: { type: 'mute', target: 'AAPL' } })
      expect(rows).toHaveLength(1)
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

  it('findMutedTargets returns muted targets but not targets of a different type', async () => {
    const db = getPrismaClient()

    try {
      const repo = new UserPreferenceRepository(db)
      await repo.mute('AAPL')

      await db.userPreference.create({
        data: { type: 'other_type', target: 'OTHER_TYPE_TARGET' },
      })

      const targets = await repo.findMutedTargets()

      expect(targets).toContain('AAPL')
      expect(targets).not.toContain('OTHER_TYPE_TARGET')
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
