import type { PrismaClient } from '@prisma/client'
import { UserPreferenceRepository } from '../../db/userPreferenceRepository.js'
import type { CommandArgs } from './types.js'

const USAGE_MESSAGE = '用法：/investment mute <ticker|topic>'

export async function buildMuteMessage(db: PrismaClient, target: string): Promise<string> {
  if (!target) return USAGE_MESSAGE

  const userPreferenceRepository = new UserPreferenceRepository(db)
  await userPreferenceRepository.mute(target)

  return `已將「${target}」加入靜音清單，相關警示將不再發送。`
}

export function createMuteCommandHandler(db: PrismaClient) {
  return async ({ command, ack, respond }: CommandArgs): Promise<void> => {
    await ack()
    const target = (command.text ?? '').trim()
    const text = await buildMuteMessage(db, target)
    await respond({ text })
  }
}
