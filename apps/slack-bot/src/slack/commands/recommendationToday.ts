import type { PrismaClient } from '@prisma/client'
import { DailyRecommendationRepository } from '../../db/dailyRecommendationRepository.js'
import { renderDailyRecommendation } from '../../renderers/dailyRecommendation.js'
import { toRenderInput } from './dailyRecommendationMapper.js'
import type { CommandArgs } from './types.js'

const NO_RECOMMENDATION_MESSAGE = '今日尚無投資建議。'

export async function buildRecommendationTodayMessage(db: PrismaClient): Promise<string> {
  const repo = new DailyRecommendationRepository(db)
  const latest = await repo.findLatest('GLOBAL')
  if (!latest) return NO_RECOMMENDATION_MESSAGE
  return renderDailyRecommendation(toRenderInput(latest))
}

export function createRecommendationTodayCommandHandler(db: PrismaClient) {
  return async ({ ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const text = await buildRecommendationTodayMessage(db)
    await respond({ text })
  }
}
