import type { PrismaClient } from '@prisma/client'
import { DailyRecommendationRepository } from '../../db/dailyRecommendationRepository.js'
import { renderDailyRecommendation } from '../../renderers/dailyRecommendation.js'
import { toRenderInput } from './dailyRecommendationMapper.js'
import { taipeiDayRangeUtc } from '../taipeiDate.js'
import type { CommandArgs } from './types.js'

const NO_BRIEF_MESSAGES = {
  TW: '今日台股尚無簡報',
  US: '今日美股尚無簡報',
} as const

export async function buildBriefMarketMessage(
  db: PrismaClient,
  market: 'TW' | 'US',
  now: Date = new Date()
): Promise<string> {
  const repo = new DailyRecommendationRepository(db)
  const { start, end } = taipeiDayRangeUtc(now)
  const rec = await repo.findForDateRange(market, start, end)
  if (!rec) return NO_BRIEF_MESSAGES[market]
  return renderDailyRecommendation(toRenderInput(rec))
}

export function createBriefTwCommandHandler(db: PrismaClient) {
  return async ({ ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const text = await buildBriefMarketMessage(db, 'TW')
    await respond({ text })
  }
}

export function createBriefUsCommandHandler(db: PrismaClient) {
  return async ({ ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const text = await buildBriefMarketMessage(db, 'US')
    await respond({ text })
  }
}
