import pkg from '@slack/bolt'
import { loadConfig } from './config/index.js'
import { getPrismaClient } from './db/prismaClient.js'
import { createInvestmentCommandHandler } from './slack/commands/router.js'
import { pathToFileURL } from 'url'

const { App } = pkg
type SlackApp = InstanceType<typeof App>

export async function main(): Promise<SlackApp> {
  const config = loadConfig()
  const db = getPrismaClient()
  const isDryRun = process.argv.includes('--dry-run')
  const app = new App({
    token: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    socketMode: true,
    tokenVerificationEnabled: !isDryRun,
  })

  app.command('/investment', createInvestmentCommandHandler(db))

  if (isDryRun) {
    console.log('Investment helper Slack bot startup check passed (dry run)')
    return app
  }

  await app.start()
  console.log('Investment helper Slack bot is running (Socket Mode)')

  const handleSignal = async (): Promise<void> => {
    await app.stop()
    process.exit(0)
  }
  process.on('SIGTERM', handleSignal)
  process.on('SIGINT', handleSignal)

  return app
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
