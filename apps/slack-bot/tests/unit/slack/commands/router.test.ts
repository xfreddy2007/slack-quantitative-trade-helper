import { describe, it, expect, vi } from 'vitest'
import { createInvestmentCommandHandler, USAGE_MESSAGE } from '../../../../src/slack/commands/router.js'
import { getPrismaClient } from '../../../../src/db/prismaClient.js'
import type { CommandArgs } from '../../../../src/slack/commands/types.js'

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
})
