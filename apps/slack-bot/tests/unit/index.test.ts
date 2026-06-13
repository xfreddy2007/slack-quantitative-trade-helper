import { describe, it, expect, vi, beforeEach } from 'vitest'

const startMock = vi.fn().mockResolvedValue(undefined)
const stopMock = vi.fn().mockResolvedValue(undefined)
const commandMock = vi.fn()
const AppMock = vi.fn().mockImplementation(() => ({
  command: commandMock,
  start: startMock,
  stop: stopMock,
}))

vi.mock('@slack/bolt', () => ({
  App: AppMock,
}))

beforeEach(() => {
  process.env.SLACK_BOT_TOKEN = 'xoxb-test'
  process.env.SLACK_APP_TOKEN = 'xapp-test'
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://investment:investment@localhost:5433/investment_helper'
  process.env.LLM_PROVIDER = 'anthropic'

  AppMock.mockClear()
  startMock.mockClear()
  stopMock.mockClear()
  commandMock.mockClear()
})

describe('src/index', () => {
  it('importing the module does not auto-invoke main()', async () => {
    await import('../../src/index.js')

    expect(startMock).not.toHaveBeenCalled()
    expect(AppMock).not.toHaveBeenCalled()
  })

  it('main() starts the app in Socket Mode without connecting to the real Slack API', async () => {
    const { main } = await import('../../src/index.js')

    const app = await main()

    expect(AppMock).toHaveBeenCalledTimes(1)
    expect(AppMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'xoxb-test',
        appToken: 'xapp-test',
        socketMode: true,
      })
    )
    expect(commandMock).toHaveBeenCalledWith('/investment', expect.any(Function))
    expect(startMock).toHaveBeenCalledTimes(1)
    expect(app).toBe(AppMock.mock.results[0]?.value)
  })
})
