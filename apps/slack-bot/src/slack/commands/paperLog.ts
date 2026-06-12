import type { PrismaClient } from '@prisma/client'
import { PaperRecommendationRepository } from '../../db/paperRecommendationRepository.js'
import { renderPaperLog } from '../../renderers/paperLog.js'
import type { CommandArgs } from './types.js'

export async function buildPaperLogMessage(db: PrismaClient): Promise<string> {
  const repo = new PaperRecommendationRepository(db)
  const records = await repo.findRecent(10)
  return renderPaperLog(records)
}

export function createPaperLogCommandHandler(db: PrismaClient) {
  return async ({ ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const text = await buildPaperLogMessage(db)
    await respond({ text })
  }
}
