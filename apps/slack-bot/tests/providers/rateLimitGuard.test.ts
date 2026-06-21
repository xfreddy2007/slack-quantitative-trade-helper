import { describe, it, expect, vi } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { RateLimitGuard, RateLimitExceeded } from '../../src/providers/rate-limit-guard.js'

function tempPath(): string {
  return join(tmpdir(), `rl-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
}

describe('RateLimitGuard', () => {
  it('allows up to limit calls within same UTC day', () => {
    const guard = new RateLimitGuard(tempPath(), { limit: 3 })
    expect(() => guard.check()).not.toThrow()
    expect(() => guard.check()).not.toThrow()
    expect(() => guard.check()).not.toThrow()
  })

  it('call exceeding limit throws RateLimitExceeded', () => {
    const guard = new RateLimitGuard(tempPath(), { limit: 3 })
    guard.check()
    guard.check()
    guard.check()
    expect(() => guard.check()).toThrow(RateLimitExceeded)
  })

  it('logs a warning when the limit is exceeded', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const guard = new RateLimitGuard(tempPath(), { limit: 1 })
    guard.check()
    expect(() => guard.check()).toThrow(RateLimitExceeded)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rate limit reached'))
    warn.mockRestore()
  })

  it('26th call throws with default limit of 25', () => {
    const guard = new RateLimitGuard(tempPath())
    for (let i = 0; i < 25; i++) guard.check()
    expect(() => guard.check()).toThrow(RateLimitExceeded)
  })

  it('counter resets when UTC date changes', () => {
    const statePath = tempPath()
    const day1 = new Date('2026-06-19T23:00:00Z')
    const day2 = new Date('2026-06-20T01:00:00Z')

    const guard1 = new RateLimitGuard(statePath, { limit: 3, clock: () => day1 })
    guard1.check()
    guard1.check()
    guard1.check()

    const guard2 = new RateLimitGuard(statePath, { limit: 3, clock: () => day2 })
    expect(() => guard2.check()).not.toThrow()
  })

  it('count persists across instances using same statePath', () => {
    const statePath = tempPath()
    const guard1 = new RateLimitGuard(statePath, { limit: 5 })
    guard1.check()
    guard1.check()
    guard1.check()

    const guard2 = new RateLimitGuard(statePath, { limit: 5 })
    guard2.check()
    guard2.check()
    expect(() => guard2.check()).toThrow(RateLimitExceeded)
  })

  it('error is instanceof RateLimitExceeded and Error', () => {
    const guard = new RateLimitGuard(tempPath(), { limit: 0 })
    try {
      guard.check()
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitExceeded)
      expect(e).toBeInstanceOf(Error)
    }
  })
})
