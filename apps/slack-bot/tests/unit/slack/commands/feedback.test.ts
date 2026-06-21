import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import {
  buildFeedbackMessage,
  createFeedbackCommandHandler,
  VALID_FEEDBACK_LABELS,
} from '../../../../src/slack/commands/feedback.js'
import { NOT_FOUND_MESSAGE } from '../../../../src/slack/commands/explain.js'
import { getPrismaClient, shutdown } from '../../../../src/db/prismaClient.js'
import type { CommandArgs } from '../../../../src/slack/commands/types.js'

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

const INVALID_LABEL_MESSAGE = `無效的回饋標籤。可用標籤：${VALID_FEEDBACK_LABELS.join(', ')}`
const TEST_MARKER = 't421-feedback-command-test'

const createdFeedbackEventIds: string[] = []
const createdRecommendationIds: string[] = []
const createdSnapshotIds: string[] = []

afterEach(async () => {
  const db = getPrismaClient()
  try {
    if (createdFeedbackEventIds.length > 0) {
      await db.feedbackEvent.deleteMany({ where: { id: { in: createdFeedbackEventIds } } })
      createdFeedbackEventIds.length = 0
    }
    if (createdRecommendationIds.length > 0) {
      await db.paperRecommendation.deleteMany({ where: { id: { in: createdRecommendationIds } } })
      createdRecommendationIds.length = 0
    }
    if (createdSnapshotIds.length > 0) {
      await db.portfolioSnapshot.deleteMany({ where: { id: { in: createdSnapshotIds } } })
      createdSnapshotIds.length = 0
    }
  } catch {
    // best-effort cleanup
  }
})

afterAll(async () => {
  await shutdown()
})

async function seedRecommendation(db: ReturnType<typeof getPrismaClient>) {
  const snapshot = await db.portfolioSnapshot.create({
    data: { snapshotDate: new Date() },
  })
  createdSnapshotIds.push(snapshot.id)

  const rec = await db.paperRecommendation.create({
    data: {
      sourceType: 'trigger',
      symbol: 'TEST.TW',
      market: 'TW',
      action: 'buy',
      suggestedSizeMinPct: 1.5,
      suggestedSizeMaxPct: 3,
      rationale: TEST_MARKER,
      confidence: 4,
      portfolioSnapshotId: snapshot.id,
      evaluationStatus: 'pending',
    },
  })
  createdRecommendationIds.push(rec.id)

  return rec
}

describe('commands/feedback', () => {
  it('valid id and "useful" label returns confirmation and creates a feedback_events row', async () => {
    const db = getPrismaClient()

    try {
      const rec = await seedRecommendation(db)

      const text = await buildFeedbackMessage(db, `${rec.id} useful`)

      expect(text).toContain('useful')

      const rows = await db.feedbackEvent.findMany({ where: { paperRecommendationId: rec.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.feedback).toBe('useful')
      createdFeedbackEventIds.push(...rows.map((r) => r.id))
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

  it.each(VALID_FEEDBACK_LABELS)('accepts valid label "%s"', async (label) => {
    const db = getPrismaClient()

    try {
      const rec = await seedRecommendation(db)

      const text = await buildFeedbackMessage(db, `${rec.id} ${label}`)

      expect(text).toContain(label)

      const rows = await db.feedbackEvent.findMany({ where: { paperRecommendationId: rec.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.feedback).toBe(label)
      createdFeedbackEventIds.push(...rows.map((r) => r.id))
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

  it('invalid label returns error message listing all valid labels and writes nothing', async () => {
    const db = getPrismaClient()

    try {
      const rec = await seedRecommendation(db)

      const text = await buildFeedbackMessage(db, `${rec.id} bogus_label`)

      expect(text).toBe(INVALID_LABEL_MESSAGE)
      for (const label of VALID_FEEDBACK_LABELS) {
        expect(text).toContain(label)
      }

      const rows = await db.feedbackEvent.findMany({ where: { paperRecommendationId: rec.id } })
      expect(rows).toHaveLength(0)
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

  it('missing label (only id provided) returns invalid-label message and writes nothing', async () => {
    const db = getPrismaClient()

    try {
      const rec = await seedRecommendation(db)

      const text = await buildFeedbackMessage(db, `${rec.id}`)

      expect(text).toBe(INVALID_LABEL_MESSAGE)

      const rows = await db.feedbackEvent.findMany({ where: { paperRecommendationId: rec.id } })
      expect(rows).toHaveLength(0)
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

  it('nonexistent id returns NOT_FOUND_MESSAGE and writes nothing', async () => {
    const db = getPrismaClient()

    try {
      const text = await buildFeedbackMessage(db, 'nonexistent-id useful')

      expect(text).toBe(NOT_FOUND_MESSAGE)

      const rows = await db.feedbackEvent.findMany({ where: { paperRecommendationId: 'nonexistent-id' } })
      expect(rows).toHaveLength(0)
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

  it('handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createFeedbackCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'nonexistent-id useful' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })
})
