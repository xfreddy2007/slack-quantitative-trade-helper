import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { buildPaperLogMessage, createPaperLogCommandHandler } from '../../../../src/slack/commands/paperLog.js'
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

const TEST_MARKER = 't412-paper-log-command-test'

const createdRecommendationIds: string[] = []
const createdSnapshotIds: string[] = []

afterEach(async () => {
  const db = getPrismaClient()
  try {
    if (createdRecommendationIds.length > 0) {
      await db.paperEvaluation.deleteMany({
        where: { paperRecommendationId: { in: createdRecommendationIds } },
      })
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

describe('commands/paperLog', () => {
  it('handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createPaperLogCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: {}, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('buildPaperLogMessage renders a seeded PaperRecommendation row with its details', async () => {
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

      const text = await buildPaperLogMessage(db)

      expect(text).toContain('```')
      expect(text).toContain(rec.id)
      expect(text).toContain('buy')
      expect(text).toContain('TEST.TW')
      expect(text).toContain('TW')
      expect(text).toContain('pending')
      expect(text).toContain('1.5%–3%')
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

  it('buildPaperLogMessage shows evaluation status and return summary for an evaluated record', async () => {
    const db = getPrismaClient()

    try {
      const snapshot = await db.portfolioSnapshot.create({ data: { snapshotDate: new Date() } })
      createdSnapshotIds.push(snapshot.id)

      const rec = await db.paperRecommendation.create({
        data: {
          sourceType: 'trigger',
          symbol: 'EVAL.US',
          market: 'US',
          action: 'buy',
          rationale: TEST_MARKER,
          confidence: 5,
          portfolioSnapshotId: snapshot.id,
          evaluationStatus: 'evaluated',
        },
      })
      createdRecommendationIds.push(rec.id)

      await db.paperEvaluation.create({
        data: {
          paperRecommendationId: rec.id,
          horizonDays: 20,
          returnPct: 2.2,
          disciplineClassification: 'improved',
          priceDataAvailable: true,
        },
      })

      const text = await buildPaperLogMessage(db)

      expect(text).toContain('EVAL.US')
      expect(text).toContain('evaluated')
      expect(text).toContain('+2.2% (20d)')
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
