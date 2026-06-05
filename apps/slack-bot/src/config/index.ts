import { z } from 'zod'
import { fileURLToPath, pathToFileURL } from 'url'

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  LLM_PROVIDER: z.enum(['openai', 'gemini', 'github_copilot', 'anthropic']),
  TZ: z.string().default('Asia/Taipei'),
  USER_LANGUAGE: z.string().default('zh-TW'),
  ALPHA_VANTAGE_API_KEY: z.string().optional(),
  FINMIND_API_KEY: z.string().optional(),
})

export type Config = z.infer<typeof EnvSchema>

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = EnvSchema.safeParse(env)
  if (!result.success) {
    const missing = result.error.issues
      .filter(
        (i) =>
          (i.code === 'invalid_type' && i.received === 'undefined') ||
          i.code === 'too_small'
      )
      .map((i) => String(i.path[0]))
    if (missing.length > 0) {
      throw new Error(`Missing required environment variable: ${missing.join(', ')}`)
    }
    const details = result.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`)
    throw new Error(`Invalid environment configuration: ${details.join('; ')}`)
  }
  return result.data
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    loadConfig()
    console.log('Environment configuration valid')
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}
