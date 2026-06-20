import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export class RateLimitExceeded extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitExceeded'
  }
}

type State = { utcDate: string; count: number }

function todayUtc(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export class RateLimitGuard {
  private readonly limit: number
  private readonly clock: () => Date

  constructor(
    private readonly statePath: string,
    opts?: { limit?: number; clock?: () => Date }
  ) {
    this.limit = opts?.limit ?? 25
    this.clock = opts?.clock ?? (() => new Date())
  }

  private read(): State {
    try {
      return JSON.parse(readFileSync(this.statePath, 'utf-8')) as State
    } catch {
      return { utcDate: '', count: 0 }
    }
  }

  private write(state: State): void {
    mkdirSync(dirname(this.statePath), { recursive: true })
    writeFileSync(this.statePath, JSON.stringify(state))
  }

  check(): void {
    const today = todayUtc(this.clock())
    const state = this.read()
    const count = state.utcDate === today ? state.count : 0
    if (count >= this.limit) {
      const msg = `Alpha Vantage rate limit reached (${this.limit}/day). Resets at UTC midnight.`
      console.warn(`[RateLimitGuard] ${msg}`)
      throw new RateLimitExceeded(msg)
    }
    this.write({ utcDate: today, count: count + 1 })
  }
}
