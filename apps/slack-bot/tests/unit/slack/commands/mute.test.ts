import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { buildMuteMessage, createMuteCommandHandler } from '../../../../src/slack/commands/mute.js'
import { UserPreferenceRepository } from '../../../../src/db/userPreferenceRepository.js'
import { checkMute } from '../../../../src/orchestration/alertMute.js'
import { getPrismaClient, shutdown } from '../../../../src/db/prismaClient.js'
import type { CommandArgs } from '../../../../src/slack/commands/types.js'

const SKIP_PATTERNS = [
  'ECONNREFUSED',
  'P1001',
  'P1013',
  'DATABASE_URL',
  "Can't reach database server",
]

function isDbUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return SKIP_PATTERNS.some((p) => msg.includes(p))
}

const USAGE_MESSAGE = '用法：/investment mute <ticker|topic>'
const TEST_TARGETS = ['AAPL', 'MSFT']

afterEach(async () => {
  const db = getPrismaClient()
  try {
    await db.userPreference.deleteMany({ where: { target: { in: TEST_TARGETS } } })
  } catch {
    // best-effort cleanup
  }
})

afterAll(async () => {
  await shutdown()
})

describe('commands/mute', () => {
  it('buildMuteMessage with empty target returns usage message without writing to DB', async () => {
    const db = getPrismaClient()

    try {
      const text = await buildMuteMessage(db, '')

      expect(text).toBe(USAGE_MESSAGE)

      const rows = await db.userPreference.findMany({ where: { target: { in: TEST_TARGETS } } })
      expect(rows).toHaveLength(0)
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })

  it('buildMuteMessage with a target returns confirmation and persists the mute', async () => {
    const db = getPrismaClient()

    try {
      const text = await buildMuteMessage(db, 'AAPL')

      expect(text).toContain('AAPL')

      const row = await db.userPreference.findUnique({
        where: { type_target: { type: 'mute', target: 'AAPL' } },
      })
      expect(row).not.toBeNull()
      expect(row?.type).toBe('mute')
      expect(row?.target).toBe('AAPL')
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })

  it('handler calls ack and respond', async () => {
    const db = getPrismaClient()
    const handler = createMuteCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'MSFT' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('end-to-end: a muted ticker causes checkMute to suppress a matching alert', async () => {
    const db = getPrismaClient()

    try {
      await buildMuteMessage(db, 'AAPL')

      const repo = new UserPreferenceRepository(db)
      const mutedTargets = await repo.findMutedTargets()

      const result = checkMute(mutedTargets, ['AAPL'])

      expect(result).toEqual({ decision: 'suppress', reason: 'muted' })
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })
})
