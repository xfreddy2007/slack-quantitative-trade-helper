import { describe, it, expect, afterAll, vi } from 'vitest'
import { buildStatusMessage, createStatusCommandHandler } from '../../../../src/slack/commands/status.js'
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

const TEST_MARKER = 't411-status-command-test'
let createdSnapshotId: string | undefined
let createdRecommendationId: string | undefined

afterAll(async () => {
  const db = getPrismaClient()
  try {
    if (createdRecommendationId) {
      await db.dailyRecommendation.deleteMany({ where: { id: createdRecommendationId } })
    }
    if (createdSnapshotId) {
      await db.portfolioSnapshot.deleteMany({ where: { id: createdSnapshotId } })
    }
  } catch {
    // best-effort cleanup
  }
  await shutdown()
})

describe('commands/status', () => {
  it('handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createStatusCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: {}, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('buildStatusMessage reports Database: connected and a Last recommendation line', async () => {
    const db = getPrismaClient()

    try {
      const text = await buildStatusMessage(db)
      expect(text).toContain('Database: connected')
      expect(text).toContain('Last recommendation:')
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

  it('buildStatusMessage reflects the latest DailyRecommendation createdAt timestamp', async () => {
    const db = getPrismaClient()

    try {
      // Use a far-future recommendationDate so this row is guaranteed to be
      // the "latest" recommendation regardless of other seeded data.
      const futureDate = new Date('2099-01-01T00:00:00Z')

      const snapshot = await db.portfolioSnapshot.create({
        data: { snapshotDate: futureDate },
      })
      createdSnapshotId = snapshot.id

      const recommendation = await db.dailyRecommendation.create({
        data: {
          market: 'GLOBAL',
          portfolioSnapshotId: snapshot.id,
          recommendationDate: futureDate,
          observations: [],
          recommendedAdjustments: [],
          noActionRationale: TEST_MARKER,
        },
      })
      createdRecommendationId = recommendation.id

      const latest = await db.dailyRecommendation.findFirst({
        orderBy: [{ recommendationDate: 'desc' }, { createdAt: 'desc' }],
      })

      const text = await buildStatusMessage(db)
      expect(text).toContain('Database: connected')
      expect(text).toContain(`Last recommendation: ${latest!.createdAt.toISOString()}`)
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
