import type { PrismaClient } from '@prisma/client'
import { buildStatusMessage } from './status.js'
import { buildPortfolioMessage } from './portfolio.js'
import { buildRecommendationTodayMessage } from './recommendationToday.js'
import { buildBriefTodayMessage } from './briefToday.js'
import { buildBriefMarketMessage } from './briefMarket.js'
import { buildPaperLogMessage } from './paperLog.js'
import { buildExplainMessage } from './explain.js'
import { buildMuteMessage } from './mute.js'
import { buildFeedbackMessage } from './feedback.js'
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
  '- mute <ticker|topic>',
  '- feedback <id> <useful|not_useful|too_noisy|too_late>',
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
    } else if (subcommand.startsWith('mute ')) {
      const target = rawText.slice('mute '.length).trim()
      text = await buildMuteMessage(db, target)
    } else if (subcommand.startsWith('feedback ')) {
      const args = rawText.slice('feedback '.length).trim()
      text = await buildFeedbackMessage(db, args)
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
