import { describe, it, expect, afterAll } from 'vitest'
import { TriggerRepository } from '../../../src/db/triggerRepository.js'
import { getPrismaClient, shutdown } from '../../../src/db/prismaClient.js'
import { TRIGGER_MODEL_VERSION, type TriggerScore } from '../../../src/orchestration/triggerScoring.js'

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

const TEST_EVENT_URL = 'https://test.example.com/t341-trigger-repo-test'
const VERSION_META = { modelVersion: TRIGGER_MODEL_VERSION, schemaVersion: '1.0.0' }

function buildScore(overrides: Partial<TriggerScore> = {}): TriggerScore {
  return {
    severity: 4,
    confidence: 4,
    relevance: 4,
    polarity: 'bearish',
    adverseLikelihood: 0.5,
    evalHorizonClass: 'acute',
    suggestedAction: 'reduce_position',
    rationale: 'market=GLOBAL, severity=4, confidence=4, relevance=4',
    humanReviewRequired: false,
    isDuplicate: false,
    portfolioSymbols: [],
    eventIds: [TEST_EVENT_URL],
    ...overrides,
  }
}

afterAll(async () => {
  const db = getPrismaClient()
  try {
    await db.triggerEvaluation.deleteMany({ where: { eventIds: { has: TEST_EVENT_URL } } })
  } catch {
    // best-effort cleanup
  }
  await shutdown()
})

describe('TriggerRepository — integration', () => {
  it('persists trigger_evaluation row with schemaVersion and modelVersion', async () => {
    const db = getPrismaClient()
    const repo = new TriggerRepository(db)

    try {
      const { id, isNew } = await repo.upsertTriggerEvaluation(buildScore(), VERSION_META)
      expect(isNew).toBe(true)

      const row = await db.triggerEvaluation.findUnique({ where: { id } })
      expect(row).not.toBeNull()
      expect(row!.eventIds).toEqual([TEST_EVENT_URL])
      expect(row!.severity).toBe(4)
      expect(row!.modelVersion).toBe(VERSION_META.modelVersion)
      expect(row!.schemaVersion).toBe(VERSION_META.schemaVersion)
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

  it('findPriorSeverity returns severity of the most recent matching evaluation', async () => {
    const db = getPrismaClient()
    const repo = new TriggerRepository(db)
    const url = `${TEST_EVENT_URL}-prior`

    try {
      await db.triggerEvaluation.deleteMany({ where: { eventIds: { has: url } } })
      expect(await repo.findPriorSeverity([url])).toBeUndefined()

      await repo.upsertTriggerEvaluation(buildScore({ eventIds: [url], severity: 3 }), VERSION_META)
      expect(await repo.findPriorSeverity([url])).toBe(3)

      await db.triggerEvaluation.deleteMany({ where: { eventIds: { has: url } } })
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

  it('a second identical run does not create a duplicate trigger_evaluation for the same event', async () => {
    const db = getPrismaClient()
    const repo = new TriggerRepository(db)
    const url = `${TEST_EVENT_URL}-dup`

    try {
      await db.triggerEvaluation.deleteMany({ where: { eventIds: { has: url } } })

      const first = await repo.upsertTriggerEvaluation(
        buildScore({ eventIds: [url], severity: 4, isDuplicate: false }),
        VERSION_META
      )
      expect(first.isNew).toBe(true)

      const second = await repo.upsertTriggerEvaluation(
        buildScore({ eventIds: [url], severity: 4, isDuplicate: true }),
        VERSION_META
      )
      expect(second.isNew).toBe(false)
      expect(second.id).toBe(first.id)

      const count = await db.triggerEvaluation.count({ where: { eventIds: { equals: [url] } } })
      expect(count).toBe(1)

      await db.triggerEvaluation.deleteMany({ where: { eventIds: { has: url } } })
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

  it('severity increase on the same event creates a new trigger_evaluation row', async () => {
    const db = getPrismaClient()
    const repo = new TriggerRepository(db)
    const url = `${TEST_EVENT_URL}-escalate`

    try {
      await db.triggerEvaluation.deleteMany({ where: { eventIds: { has: url } } })

      const first = await repo.upsertTriggerEvaluation(
        buildScore({ eventIds: [url], severity: 3, isDuplicate: false }),
        VERSION_META
      )
      const second = await repo.upsertTriggerEvaluation(
        buildScore({ eventIds: [url], severity: 4, isDuplicate: false }),
        VERSION_META
      )

      expect(second.isNew).toBe(true)
      expect(second.id).not.toBe(first.id)

      const rows = await db.triggerEvaluation.findMany({ where: { eventIds: { equals: [url] } } })
      expect(rows.map((r) => r.severity).sort()).toEqual([3, 4])

      await db.triggerEvaluation.deleteMany({ where: { eventIds: { has: url } } })
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
