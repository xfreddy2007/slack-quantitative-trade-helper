import type { PrismaClient } from '@prisma/client'
import { PaperRecommendationRepository } from '../../db/paperRecommendationRepository.js'
import { TriggerRepository } from '../../db/triggerRepository.js'
import { renderExplain } from '../../renderers/explain.js'
import type { CommandArgs } from './types.js'

export const NOT_FOUND_MESSAGE = '找不到此 ID。'

async function findCitationsForTrigger(triggerRepo: TriggerRepository, triggerId: string): Promise<string[]> {
  const trigger = await triggerRepo.findById(triggerId)
  return trigger ? triggerRepo.findCitations(trigger.eventIds) : []
}

export async function buildExplainMessage(db: PrismaClient, id: string): Promise<string> {
  if (!id) return NOT_FOUND_MESSAGE

  const paperRepo = new PaperRecommendationRepository(db)
  const triggerRepo = new TriggerRepository(db)

  const recommendation = await paperRepo.findById(id)
  if (recommendation) {
    const citations =
      recommendation.sourceType === 'trigger' && recommendation.sourceId
        ? await findCitationsForTrigger(triggerRepo, recommendation.sourceId)
        : []
    return renderExplain(recommendation.rationale, citations)
  }

  const trigger = await triggerRepo.findById(id)
  if (trigger) {
    const citations = await triggerRepo.findCitations(trigger.eventIds)
    return renderExplain(trigger.rationale, citations)
  }

  return NOT_FOUND_MESSAGE
}

export function createExplainCommandHandler(db: PrismaClient) {
  return async ({ command, ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const id = (command.text ?? '').trim()
    const text = await buildExplainMessage(db, id)
    await respond({ text })
  }
}
