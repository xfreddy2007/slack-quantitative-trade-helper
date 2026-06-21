import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { createInvestmentCommandHandler, USAGE_MESSAGE } from '../../../../src/slack/commands/router.js'
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

const NOT_FOUND_MESSAGE = '找不到此 ID。'
const TEST_MARKER_TRIGGER = 't412-router-explain-trigger-rationale'
const TEST_MUTE_TARGETS = ['AAPL', 'aapl']

const createdTriggerEvaluationIds: string[] = []

afterEach(async () => {
  const db = getPrismaClient()
  try {
    if (createdTriggerEvaluationIds.length > 0) {
      await db.triggerEvaluation.deleteMany({ where: { id: { in: createdTriggerEvaluationIds } } })
      createdTriggerEvaluationIds.length = 0
    }
    await db.userPreference.deleteMany({ where: { target: { in: TEST_MUTE_TARGETS } } })
  } catch {
    // best-effort cleanup
  }
})

afterAll(async () => {
  await shutdown()
})

describe('commands/router', () => {
  it('unknown subcommand returns usage help without throwing', async () => {
    const db = getPrismaClient()
    const handler = createInvestmentCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'not-a-real-subcommand' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: USAGE_MESSAGE })
  })

  it('empty subcommand returns usage help', async () => {
    const db = getPrismaClient()
    const handler = createInvestmentCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: '' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: USAGE_MESSAGE })
  })

  it('routes "status" subcommand to the status handler', async () => {
    const db = getPrismaClient()
    const handler = createInvestmentCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'status' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    const text = (respond.mock.calls[0]?.[0] as { text: string }).text
    expect(text).toContain('Investment Helper Status')
  })

  it('routes "brief tw" subcommand to the brief market handler', async () => {
    const db = getPrismaClient()
    const handler = createInvestmentCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'brief tw' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('routes "brief us" subcommand to the brief market handler', async () => {
    const db = getPrismaClient()
    const handler = createInvestmentCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'brief us' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('routes "paper-log" subcommand to the paper log handler', async () => {
    const db = getPrismaClient()
    const handler = createInvestmentCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'paper-log' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: expect.any(String) })
  })

  it('routes "explain <id>" with a garbage id to the explain handler and returns not-found', async () => {
    const db = getPrismaClient()
    const handler = createInvestmentCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: 'explain this-id-does-not-exist-garbage-123' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: NOT_FOUND_MESSAGE })
  })

  it('routes mixed-case "Explain <id>" and preserves the id casing when looking up a real TriggerEvaluation', async () => {
    const db = getPrismaClient()

    try {
      const trigger = await db.triggerEvaluation.create({
        data: {
          eventIds: [],
          portfolioSymbols: [],
          severity: 2,
          confidence: 3,
          relevance: 3,
          suggestedAction: 'hold',
          rationale: TEST_MARKER_TRIGGER,
        },
      })
      createdTriggerEvaluationIds.push(trigger.id)

      const handler = createInvestmentCommandHandler(db)
      const ack = vi.fn().mockResolvedValue(undefined)
      const respond = vi.fn().mockResolvedValue(undefined)

      await handler({ command: { text: `Explain ${trigger.id}` }, ack, respond } as unknown as CommandArgs)

      expect(ack).toHaveBeenCalledTimes(1)
      const text = (respond.mock.calls[0]?.[0] as { text: string }).text
      expect(text).toContain(TEST_MARKER_TRIGGER)
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

  it('USAGE_MESSAGE includes the mute and feedback subcommand lines', () => {
    expect(USAGE_MESSAGE).toContain('mute <ticker|topic>')
    expect(USAGE_MESSAGE).toContain('feedback <id> <useful|not_useful|too_noisy|too_late>')
  })

  it('routes "mute AAPL" subcommand to the mute handler and persists the target', async () => {
    const db = getPrismaClient()

    try {
      const handler = createInvestmentCommandHandler(db)
      const ack = vi.fn().mockResolvedValue(undefined)
      const respond = vi.fn().mockResolvedValue(undefined)

      await handler({ command: { text: 'mute AAPL' }, ack, respond } as unknown as CommandArgs)

      expect(ack).toHaveBeenCalledTimes(1)
      const text = (respond.mock.calls[0]?.[0] as { text: string }).text
      expect(text).toContain('AAPL')
      expect(text).toContain('已將「AAPL」加入靜音清單，相關警示將不再發送。')

      const row = await db.userPreference.findUnique({
        where: { type_target: { type: 'mute', target: 'AAPL' } },
      })
      expect(row).not.toBeNull()
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

  it('routes "mute aapl" subcommand preserving the lowercase target case', async () => {
    const db = getPrismaClient()

    try {
      const handler = createInvestmentCommandHandler(db)
      const ack = vi.fn().mockResolvedValue(undefined)
      const respond = vi.fn().mockResolvedValue(undefined)

      await handler({ command: { text: 'mute aapl' }, ack, respond } as unknown as CommandArgs)

      expect(ack).toHaveBeenCalledTimes(1)
      const text = (respond.mock.calls[0]?.[0] as { text: string }).text
      expect(text).toContain('aapl')

      const row = await db.userPreference.findUnique({
        where: { type_target: { type: 'mute', target: 'aapl' } },
      })
      expect(row).not.toBeNull()
      expect(row?.target).toBe('aapl')
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

  it('routes "feedback <id> useful" subcommand to the feedback handler', async () => {
    const db = getPrismaClient()

    try {
      const handler = createInvestmentCommandHandler(db)
      const ack = vi.fn().mockResolvedValue(undefined)
      const respond = vi.fn().mockResolvedValue(undefined)

      await handler({ command: { text: 'feedback router-feedback-bogus useful' }, ack, respond } as unknown as CommandArgs)

      expect(ack).toHaveBeenCalledTimes(1)
      const text = (respond.mock.calls[0]?.[0] as { text: string }).text
      expect(text).toBe(NOT_FOUND_MESSAGE)
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
