import { describe, it, expect, afterAll, afterEach } from 'vitest'
import { FeedbackEventRepository } from '../../../src/db/feedbackEventRepository.js'
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

const TEST_MARKER = 't421-feedback-event-repository-test'

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

describe('db/feedbackEventRepository', () => {
  it('create writes a feedback_events row with correct feedback and paperRecommendationId', async () => {
    const db = getPrismaClient()

    try {
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

      const repo = new FeedbackEventRepository(db)
      const event = await repo.create(rec.id, 'useful')
      createdFeedbackEventIds.push(event.id)

      expect(event.feedback).toBe('useful')
      expect(event.paperRecommendationId).toBe(rec.id)

      const row = await db.feedbackEvent.findUnique({ where: { id: event.id } })
      expect(row?.feedback).toBe('useful')
      expect(row?.paperRecommendationId).toBe(rec.id)
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
