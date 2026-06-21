import type { PrismaClient } from '@prisma/client'
import { DailyRecommendationRepository } from '../../db/dailyRecommendationRepository.js'
import { renderDailyRecommendation } from '../../renderers/dailyRecommendation.js'
import { toRenderInput } from './dailyRecommendationMapper.js'
import { taipeiDayRangeUtc } from '../taipeiDate.js'
import type { CommandArgs } from './types.js'

const NO_BRIEF_MESSAGE = '今日尚無市場簡報'

export async function buildBriefTodayMessage(db: PrismaClient, now: Date = new Date()): Promise<string> {
  const repo = new DailyRecommendationRepository(db)
  const { start, end } = taipeiDayRangeUtc(now)

  const [tw, us] = await Promise.all([
    repo.findForDateRange('TW', start, end),
    repo.findForDateRange('US', start, end),
  ])

  if (!tw && !us) return NO_BRIEF_MESSAGE

  const sections: string[] = []
  sections.push(tw ? renderDailyRecommendation(toRenderInput(tw)) : `台股：${NO_BRIEF_MESSAGE}`)
  sections.push(us ? renderDailyRecommendation(toRenderInput(us)) : `美股：${NO_BRIEF_MESSAGE}`)
  return sections.join('\n\n---\n\n')
}

export function createBriefTodayCommandHandler(db: PrismaClient) {
  return async ({ ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const text = await buildBriefTodayMessage(db)
    await respond({ text })
  }
}
