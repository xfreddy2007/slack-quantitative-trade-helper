import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { buildBriefTodayMessage, createBriefTodayCommandHandler } from '../../../../src/slack/commands/briefToday.js'
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

const NO_BRIEF_MESSAGE = '今日尚無市場簡報'
const TEST_MARKER_TW = 't411-brief-today-command-test-tw'
const TEST_MARKER_US = 't411-brief-today-command-test-us'

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

describe('commands/briefToday', () => {
  it('handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createBriefTodayCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: {}, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('buildBriefTodayMessage joins TW and US sections with --- when both exist for today', async () => {
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
          observations: ['台股加權指數開低走平。'],
          recommendedAdjustments: [],
          noActionRationale: TEST_MARKER_TW,
        },
      })
      createdRecommendationIds.push(tw.id)

      const us = await db.dailyRecommendation.create({
        data: {
          market: 'US',
          portfolioSnapshotId: snapshot.id,
          recommendationDate,
          observations: ['美股期貨小幅上漲。'],
          recommendedAdjustments: [],
          noActionRationale: TEST_MARKER_US,
        },
      })
      createdRecommendationIds.push(us.id)

      const text = await buildBriefTodayMessage(db, now)

      expect(text).toContain('---')
      expect(text).toContain('- 台股加權指數開低走平。')
      expect(text).toContain(`- ${TEST_MARKER_TW}`)
      expect(text).toContain('- 美股期貨小幅上漲。')
      expect(text).toContain(`- ${TEST_MARKER_US}`)

      const sections = text.split('\n\n---\n\n')
      expect(sections).toHaveLength(2)
      expect(sections[0]).toContain('台股加權指數開低走平')
      expect(sections[1]).toContain('美股期貨小幅上漲')
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

  it('buildBriefTodayMessage returns the no-brief message when no TW/US recommendation matches the date', async () => {
    const db = getPrismaClient()

    try {
      // Use a date far in the past so no seeded row matches today's range.
      const farPast = new Date('2000-01-01T00:00:00Z')
      const text = await buildBriefTodayMessage(db, farPast)
      expect(text).toBe(NO_BRIEF_MESSAGE)
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
