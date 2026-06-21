import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PrismaClient } from '@prisma/client'
import { DailyRecommendationRepository } from '../../db/dailyRecommendationRepository.js'
import type { CommandArgs } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PACKAGE_JSON_PATH = resolve(__dirname, '../../../package.json')

function getAppVersion(): string {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as { version?: string }
  return pkg.version ?? 'unknown'
}

export async function buildStatusMessage(db: PrismaClient): Promise<string> {
  const version = getAppVersion()
  let dbStatus: 'connected' | 'error' = 'connected'
  let lastRecommendation = 'none'

  try {
    await db.$queryRaw`SELECT 1`
    const repo = new DailyRecommendationRepository(db)
    const latest = await repo.findLatest()
    if (latest) lastRecommendation = latest.createdAt.toISOString()
  } catch {
    dbStatus = 'error'
  }

  return [
    'Investment Helper Status',
    `- Version: ${version}`,
    `- Database: ${dbStatus}`,
    `- Last recommendation: ${lastRecommendation}`,
  ].join('\n')
}

export function createStatusCommandHandler(db: PrismaClient) {
  return async ({ ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const text = await buildStatusMessage(db)
    await respond({ text })
  }
}
