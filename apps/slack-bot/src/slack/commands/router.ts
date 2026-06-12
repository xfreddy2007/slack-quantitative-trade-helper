import type { PrismaClient } from '@prisma/client'
import { buildStatusMessage } from './status.js'
import { buildPortfolioMessage } from './portfolio.js'
import { buildRecommendationTodayMessage } from './recommendationToday.js'
import { buildBriefTodayMessage } from './briefToday.js'
import { buildBriefMarketMessage } from './briefMarket.js'
import { buildPaperLogMessage } from './paperLog.js'
import { buildExplainMessage } from './explain.js'
import type { CommandArgs } from './types.js'

export const USAGE_MESSAGE = [
  'Usage: /investment <subcommand>',
  'Available subcommands:',
  '- status',
  '- portfolio',
  '- recommendation today',
  '- brief today',
  '- brief tw',
  '- brief us',
  '- paper-log',
  '- explain <id>',
].join('\n')

export function createInvestmentCommandHandler(db: PrismaClient) {
  return async ({ command, ack, respond }: CommandArgs): Promise<void> => {
    await ack()

    const rawText = (command.text ?? '').trim().replace(/\s+/g, ' ')
    const subcommand = rawText.toLowerCase()

    let text: string
    if (subcommand.startsWith('explain ')) {
      const id = rawText.slice('explain '.length).trim()
      text = await buildExplainMessage(db, id)
    } else {
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
        case 'brief tw':
          text = await buildBriefMarketMessage(db, 'TW')
          break
        case 'brief us':
          text = await buildBriefMarketMessage(db, 'US')
          break
        case 'paper-log':
          text = await buildPaperLogMessage(db)
          break
        default:
          text = USAGE_MESSAGE
      }
    }

    await respond({ text })
  }
}
