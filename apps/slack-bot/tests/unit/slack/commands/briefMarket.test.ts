import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import {
  buildBriefMarketMessage,
  createBriefTwCommandHandler,
  createBriefUsCommandHandler,
} from '../../../../src/slack/commands/briefMarket.js'
import { getPrismaClient, shutdown } from '../../../../src/db/prismaClient.js'
import { taipeiDayRangeUtc } from '../../../../src/slack/taipeiDate.js'
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

const NO_BRIEF_MESSAGE_TW = '今日台股尚無簡報'
const NO_BRIEF_MESSAGE_US = '今日美股尚無簡報'
const TEST_MARKER_TW = 't412-brief-market-command-test-tw'
const TEST_MARKER_US = 't412-brief-market-command-test-us'

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

describe('commands/briefMarket', () => {
  it('TW handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createBriefTwCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: {}, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('US handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createBriefUsCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: {}, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('buildBriefMarketMessage returns the TW no-brief message when no row matches today\'s range', async () => {
    const db = getPrismaClient()

    try {
      // Use a date far in the past so no seeded row matches today's range.
      const farPast = new Date('2000-01-01T00:00:00Z')
      const text = await buildBriefMarketMessage(db, 'TW', farPast)
      expect(text).toBe(NO_BRIEF_MESSAGE_TW)
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

  it('buildBriefMarketMessage returns the US no-brief message when no row matches today\'s range', async () => {
    const db = getPrismaClient()

    try {
      // Use a date far in the past so no seeded row matches today's range.
      const farPast = new Date('2000-01-01T00:00:00Z')
      const text = await buildBriefMarketMessage(db, 'US', farPast)
      expect(text).toBe(NO_BRIEF_MESSAGE_US)
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

  it('buildBriefMarketMessage renders a seeded TW DailyRecommendation for today\'s range', async () => {
    const db = getPrismaClient()

    try {
      const now = new Date()
      const { start } = taipeiDayRangeUtc(now)
      // Use a timestamp safely inside today's Taipei range.
      const recommendationDate = new Date(start.getTime() + 60 * 60 * 1000)

      const snapshot = await db.portfolioSnapshot.create({
        data: { snapshotDate: recommendationDate },
      })
      createdSnapshotIds.push(snapshot.id)

      const tw = await db.dailyRecommendation.create({
        data: {
          market: 'TW',
          portfolioSnapshotId: snapshot.id,
          recommendationDate,
          observations: [],
          recommendedAdjustments: [],
          noActionRationale: TEST_MARKER_TW,
        },
      })
      createdRecommendationIds.push(tw.id)

      const text = await buildBriefMarketMessage(db, 'TW', now)

      expect(text).toContain(TEST_MARKER_TW)
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

  it('buildBriefMarketMessage renders a seeded US DailyRecommendation for today\'s range', async () => {
    const db = getPrismaClient()

    try {
      const now = new Date()
      const { start } = taipeiDayRangeUtc(now)
      // Use a timestamp safely inside today's Taipei range.
      const recommendationDate = new Date(start.getTime() + 60 * 60 * 1000)

      const snapshot = await db.portfolioSnapshot.create({
        data: { snapshotDate: recommendationDate },
      })
      createdSnapshotIds.push(snapshot.id)

      const us = await db.dailyRecommendation.create({
        data: {
          market: 'US',
          portfolioSnapshotId: snapshot.id,
          recommendationDate,
          observations: [],
          recommendedAdjustments: [],
          noActionRationale: TEST_MARKER_US,
        },
      })
      createdRecommendationIds.push(us.id)

      const text = await buildBriefMarketMessage(db, 'US', now)

      expect(text).toContain(TEST_MARKER_US)
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
