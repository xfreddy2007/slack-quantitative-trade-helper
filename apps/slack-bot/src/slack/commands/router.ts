import type { PrismaClient } from '@prisma/client'
import { buildStatusMessage } from './status.js'
import { buildPortfolioMessage } from './portfolio.js'
import { buildRecommendationTodayMessage } from './recommendationToday.js'
import { buildBriefTodayMessage } from './briefToday.js'
import type { CommandArgs } from './types.js'

export const USAGE_MESSAGE = [
  'Usage: /investment <subcommand>',
  'Available subcommands:',
  '- status',
  '- portfolio',
  '- recommendation today',
  '- brief today',
].join('\n')

export function createInvestmentCommandHandler(db: PrismaClient) {
  return async ({ command, ack, respond }: CommandArgs): Promise<void> => {
    await ack()

    const subcommand = (command.text ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

    let text: string
    switch (subcommand) {
      case 'status':
        text = await buildStatusMessage(db)
        break
      case 'portfolio':
        text = await buildPortfolioMessage(db)
        break
      case 'recommendation today':
        text = await buildRecommendationTodayMessage(db)
        break
      case 'brief today':
        text = await buildBriefTodayMessage(db)
        break
      default:
        text = USAGE_MESSAGE
    }

    await respond({ text })
  }
}
