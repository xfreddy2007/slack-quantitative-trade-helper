import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { buildPortfolioMessage, createPortfolioCommandHandler } from '../../../../src/slack/commands/portfolio.js'
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

const NO_PORTFOLIO_MESSAGE = '目前尚無投資組合資料，請確認每日建議流程已執行。'
const TEST_MARKER = 't411-portfolio-command-test'

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

describe('commands/portfolio', () => {
  it('handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createPortfolioCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: {}, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('buildPortfolioMessage groups observations into TW / US sections and includes snapshot totals', async () => {
    const db = getPrismaClient()

    try {
      // Use a far-future recommendationDate so this row is guaranteed to be
      // the "latest" GLOBAL recommendation regardless of other seeded data.
      const futureDate = new Date('2099-01-01T00:00:00Z')

      const snapshot = await db.portfolioSnapshot.create({
        data: {
          snapshotDate: futureDate,
          totalValueUsd: 100000,
          cashPct: 5.5,
        },
      })
      createdSnapshotIds.push(snapshot.id)

      await db.dailyRecommendation.create({
        data: {
          market: 'GLOBAL',
          portfolioSnapshotId: snapshot.id,
          recommendationDate: futureDate,
          observations: [
            'taiwan_core_etf: 28.5% (target 30.0%, drift -1.5%)',
            'us_core_etf: 38.5% (target 40.0%, drift -1.5%)',
          ],
          recommendedAdjustments: [],
          noActionRationale: TEST_MARKER,
        },
      }).then((rec) => createdRecommendationIds.push(rec.id))

      const text = await buildPortfolioMessage(db)

      expect(text).toContain('TW 配置:')
      expect(text).toContain('US 配置:')
      expect(text).toContain('- taiwan_core_etf: 28.5% (target 30.0%, drift -1.5%)')
      expect(text).toContain('- us_core_etf: 38.5% (target 40.0%, drift -1.5%)')
      expect(text).toContain('總資產價值:')
      expect(text).toContain('現金比例:')

      // Confirm bullets land under their correct section headers.
      const lines = text.split('\n')
      const twIdx = lines.findIndex((l) => l === 'TW 配置:')
      const usIdx = lines.findIndex((l) => l === 'US 配置:')
      const twBulletIdx = lines.findIndex((l) => l.startsWith('- taiwan_core_etf'))
      const usBulletIdx = lines.findIndex((l) => l.startsWith('- us_core_etf'))
      expect(twBulletIdx).toBeGreaterThan(twIdx)
      expect(twBulletIdx).toBeLessThan(usIdx)
      expect(usBulletIdx).toBeGreaterThan(usIdx)
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

  it('buildPortfolioMessage returns the no-data message when no GLOBAL recommendation exists', async () => {
    const db = getPrismaClient()

    try {
      const existingGlobalCount = await db.dailyRecommendation.count({ where: { market: 'GLOBAL' } })
      if (existingGlobalCount > 0) {
        console.warn('Skipping no-data assertion — GLOBAL recommendations already exist in DB')
        return
      }

      const text = await buildPortfolioMessage(db)
      expect(text).toBe(NO_PORTFOLIO_MESSAGE)
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
