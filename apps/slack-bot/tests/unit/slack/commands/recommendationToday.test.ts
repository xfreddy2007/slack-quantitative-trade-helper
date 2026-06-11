import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import {
  buildRecommendationTodayMessage,
  createRecommendationTodayCommandHandler,
} from '../../../../src/slack/commands/recommendationToday.js'
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

const NO_RECOMMENDATION_MESSAGE = '今日尚無投資建議。'
const TEST_MARKER = 't411-recommendation-today-command-test'
const TEST_ADJUSTMENT_RATIONALE = 't411-recommendation-today-command-test-adjustment'

const createdSnapshotIds: string[] = []
const createdRecommendationIds: string[] = []

afterEach(async () => {
  const db = getPrismaClient()
  try {
    if (createdRecommendationIds.length > 0) {
      await db.dailyRecommendation.deleteMany({ where: { id: { in: createdRecommendationIds } } })
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

describe('commands/recommendationToday', () => {
  it('handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createRecommendationTodayCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: {}, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('buildRecommendationTodayMessage renders the latest GLOBAL recommendation', async () => {
    const db = getPrismaClient()

    try {
      // Use a far-future recommendationDate (later than other test files' fixtures,
      // e.g. portfolio.test.ts's 2099-01-01) so this row is guaranteed to be the
      // "latest" GLOBAL recommendation even when test files run concurrently.
      const futureDate = new Date('2099-12-31T00:00:00Z')

      const snapshot = await db.portfolioSnapshot.create({
        data: { snapshotDate: futureDate },
      })
      createdSnapshotIds.push(snapshot.id)

      const recommendation = await db.dailyRecommendation.create({
        data: {
          market: 'GLOBAL',
          portfolioSnapshotId: snapshot.id,
          recommendationDate: futureDate,
          observations: ['整體市場波動度偏低，配置維持不變。'],
          recommendedAdjustments: [
            { action: 'rebalance', bucket: 'taiwan_core_etf', rationale: TEST_ADJUSTMENT_RATIONALE, confidence: 4 },
          ],
          noActionRationale: TEST_MARKER,
          riskLevel: 3,
          confidence: 4,
        },
      })
      createdRecommendationIds.push(recommendation.id)

      const text = await buildRecommendationTodayMessage(db)

      expect(text).toContain('今日觀察：')
      expect(text).toContain('- 整體市場波動度偏低，配置維持不變。')
      expect(text).toContain('可考慮調整：')
      expect(text).toContain(`- ${TEST_ADJUSTMENT_RATIONALE}`)
      expect(text).toContain('不建議動作：')
      expect(text).toContain(`- ${TEST_MARKER}`)
      expect(text).toContain('Paper Recommendation:')
      expect(text).toContain('風險等級')
      expect(text).toContain('信心：4/5')
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

  it('buildRecommendationTodayMessage returns the no-data message when no GLOBAL recommendation exists', async () => {
    const db = getPrismaClient()

    try {
      const existingGlobalCount = await db.dailyRecommendation.count({ where: { market: 'GLOBAL' } })
      if (existingGlobalCount > 0) {
        console.warn('Skipping no-data assertion — GLOBAL recommendations already exist in DB')
        return
      }

      const text = await buildRecommendationTodayMessage(db)
      expect(text).toBe(NO_RECOMMENDATION_MESSAGE)
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
