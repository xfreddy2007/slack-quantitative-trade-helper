import type { PrismaClient } from '@prisma/client'
import { DailyRecommendationRepository } from '../../db/dailyRecommendationRepository.js'
import type { CommandArgs } from './types.js'

const NO_PORTFOLIO_MESSAGE = '目前尚無投資組合資料，請確認每日建議流程已執行。'

function classifyBucketMarket(bucket: string): 'TW' | 'US' | 'OTHER' {
  if (/^(taiwan|tw)/i.test(bucket)) return 'TW'
  if (/^(us|usa)/i.test(bucket)) return 'US'
  return 'OTHER'
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function buildPortfolioMessage(db: PrismaClient): Promise<string> {
  const repo = new DailyRecommendationRepository(db)
  const latest = await repo.findLatest('GLOBAL')
  if (!latest) return NO_PORTFOLIO_MESSAGE

  const snapshot = await repo.findPortfolioSnapshot(latest.portfolioSnapshotId)

  const groups: Record<'TW' | 'US' | 'OTHER', string[]> = { TW: [], US: [], OTHER: [] }
  for (const obs of latest.observations) {
    const bucket = obs.split(':')[0]?.trim() ?? obs
    groups[classifyBucketMarket(bucket)].push(obs)
  }

  const lines: string[] = [`投資組合快照｜${isoDate(latest.recommendationDate)}`]
  if (snapshot?.totalValueUsd != null) lines.push(`總資產價值: $${snapshot.totalValueUsd.toString()} USD`)
  if (snapshot?.cashPct != null) lines.push(`現金比例: ${snapshot.cashPct.toString()}%`)
  lines.push('')

  lines.push('TW 配置:')
  lines.push(groups.TW.length > 0 ? groups.TW.map((o) => `- ${o}`).join('\n') : '- 無資料')
  lines.push('')

  lines.push('US 配置:')
  lines.push(groups.US.length > 0 ? groups.US.map((o) => `- ${o}`).join('\n') : '- 無資料')

  if (groups.OTHER.length > 0) {
    lines.push('')
    lines.push('其他配置:')
    lines.push(groups.OTHER.map((o) => `- ${o}`).join('\n'))
  }

  return lines.join('\n')
}

export function createPortfolioCommandHandler(db: PrismaClient) {
  return async ({ ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const text = await buildPortfolioMessage(db)
    await respond({ text })
  }
}
