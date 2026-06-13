import type { PrismaClient } from '@prisma/client'
import { PaperRecommendationRepository } from '../../db/paperRecommendationRepository.js'
import { FeedbackEventRepository } from '../../db/feedbackEventRepository.js'
import { NOT_FOUND_MESSAGE } from './explain.js'
import type { CommandArgs } from './types.js'

export const VALID_FEEDBACK_LABELS = ['useful', 'not_useful', 'too_noisy', 'too_late'] as const
export type FeedbackLabel = (typeof VALID_FEEDBACK_LABELS)[number]

const INVALID_LABEL_MESSAGE = `無效的回饋標籤。可用標籤：${VALID_FEEDBACK_LABELS.join(', ')}`

function isValidFeedbackLabel(label: string): label is FeedbackLabel {
  return (VALID_FEEDBACK_LABELS as readonly string[]).includes(label)
}

export async function buildFeedbackMessage(db: PrismaClient, rawArgs: string): Promise<string> {
  const parts = rawArgs.split(' ')
  if (parts.length !== 2 || !isValidFeedbackLabel(parts[1])) {
    return INVALID_LABEL_MESSAGE
  }

  const [id, label] = parts

  const paperRecommendationRepository = new PaperRecommendationRepository(db)
  const recommendation = await paperRecommendationRepository.findById(id)
  if (!recommendation) return NOT_FOUND_MESSAGE

  const feedbackEventRepository = new FeedbackEventRepository(db)
  await feedbackEventRepository.create(id, label)

  return `已記錄您的回饋：${label}。`
}

export function createFeedbackCommandHandler(db: PrismaClient) {
  return async ({ command, ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const rawArgs = (command.text ?? '').trim().replace(/\s+/g, ' ')
    const text = await buildFeedbackMessage(db, rawArgs)
    await respond({ text })
  }
}
