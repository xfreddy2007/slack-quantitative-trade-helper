import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadConfig } from '../../src/config/index.js'

const VALID_ENV = {
  DATABASE_URL: 'postgresql://localhost/test',
  SLACK_BOT_TOKEN: 'xoxb-test-token',
  SLACK_APP_TOKEN: 'xapp-test-token',
  LLM_PROVIDER: 'anthropic' as const,
}

describe('loadConfig', () => {
  it('throws naming DATABASE_URL when missing', () => {
    const { DATABASE_URL: _, ...env } = VALID_ENV
    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/)
  })

  it('throws naming SLACK_BOT_TOKEN when missing', () => {
    const { SLACK_BOT_TOKEN: _, ...env } = VALID_ENV
    expect(() => loadConfig(env)).toThrow(/SLACK_BOT_TOKEN/)
  })

  it('throws naming SLACK_APP_TOKEN when missing', () => {
    const { SLACK_APP_TOKEN: _, ...env } = VALID_ENV
    expect(() => loadConfig(env)).toThrow(/SLACK_APP_TOKEN/)
  })

  it('returns typed config for valid env', () => {
    const config = loadConfig(VALID_ENV)
    expect(config.DATABASE_URL).toBe('postgresql://localhost/test')
    expect(config.SLACK_BOT_TOKEN).toBe('xoxb-test-token')
    expect(config.LLM_PROVIDER).toBe('anthropic')
  })

  it('applies defaults for TZ and USER_LANGUAGE', () => {
    const config = loadConfig(VALID_ENV)
    expect(config.TZ).toBe('Asia/Taipei')
    expect(config.USER_LANGUAGE).toBe('zh-TW')
  })

  it('allows overriding TZ and USER_LANGUAGE', () => {
    const config = loadConfig({ ...VALID_ENV, TZ: 'UTC', USER_LANGUAGE: 'en' })
    expect(config.TZ).toBe('UTC')
    expect(config.USER_LANGUAGE).toBe('en')
  })

  it('throws for invalid LLM_PROVIDER value', () => {
    expect(() => loadConfig({ ...VALID_ENV, LLM_PROVIDER: 'unknown' })).toThrow(/LLM_PROVIDER/)
  })

  it('optional keys may be omitted', () => {
    const config = loadConfig(VALID_ENV)
    expect(config.ALPHA_VANTAGE_API_KEY).toBeUndefined()
    expect(config.FINMIND_API_KEY).toBeUndefined()
  })
})
