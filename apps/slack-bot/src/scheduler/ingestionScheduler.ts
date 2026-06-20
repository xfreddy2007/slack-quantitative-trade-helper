const US_EASTERN_TZ = 'America/New_York'

// U.S. regular session opens 09:30 ET; ingest 30 minutes ahead → 09:00 ET trigger.
const TRIGGER_ET_HOUR = 9
const TRIGGER_ET_MINUTE = 0
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Offset in minutes of `timeZone` from UTC at the given instant (EDT → -240, EST → -300).
 * Derived from the zone's wall-clock via Intl — no hardcoded DST date table.
 */
export function zonedOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]))
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return (asUtc - date.getTime()) / 60000
}

/** True when U.S. Eastern Time is observing DST (EDT, UTC-4) at the given instant. */
export function isUsEasternDst(date: Date): boolean {
  return zonedOffsetMinutes(date, US_EASTERN_TZ) === -240
}

/** UTC instant of the 09:00 ET ingestion trigger for the ET calendar day containing `instant`. */
export function usIngestionTriggerUtc(instant: Date): Date {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: US_EASTERN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(instant)
    .split('-')
    .map(Number)
  // Convert 09:00 ET wall-clock on that day to a UTC instant: EDT → 13:00 UTC, EST → 14:00 UTC.
  const naiveUtc = Date.UTC(year, month - 1, day, TRIGGER_ET_HOUR, TRIGGER_ET_MINUTE)
  const offset = zonedOffsetMinutes(new Date(naiveUtc), US_EASTERN_TZ)
  return new Date(naiveUtc - offset * 60000)
}

/** Next future UTC instant at which U.S. ingestion should fire, relative to `now`. */
export function nextUsIngestionRun(now: Date): Date {
  const today = usIngestionTriggerUtc(now)
  if (today.getTime() > now.getTime()) return today
  return usIngestionTriggerUtc(new Date(now.getTime() + DAY_MS))
}

export interface SchedulerHandle {
  stop(): void
}

export interface SchedulerOptions {
  onTrigger: () => void | Promise<void>
  clock?: () => Date
  setTimer?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void
}

/**
 * Market-aware scheduler: fires `onTrigger` 30 minutes before each U.S. regular open
 * (09:00 ET → 21:00 Taipei during DST, 22:00 Taipei during standard time), then reschedules.
 * `onTrigger` errors are caught so a failed ingestion can never crash the scheduler or the app.
 */
export function startUsIngestionScheduler(opts: SchedulerOptions): SchedulerHandle {
  const clock = opts.clock ?? ((): Date => new Date())
  const setTimer = opts.setTimer ?? setTimeout
  const clearTimer = opts.clearTimer ?? clearTimeout
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const scheduleNext = (): void => {
    if (stopped) return
    const now = clock()
    const delay = Math.max(0, nextUsIngestionRun(now).getTime() - now.getTime())
    timer = setTimer(() => {
      void (async (): Promise<void> => {
        try {
          await opts.onTrigger()
        } catch (err) {
          console.error(
            '[ingestionScheduler] trigger failed:',
            err instanceof Error ? err.message : err
          )
        }
        scheduleNext()
      })()
    }, delay)
  }

  scheduleNext()
  return {
    stop(): void {
      stopped = true
      if (timer) clearTimer(timer)
    },
  }
}
