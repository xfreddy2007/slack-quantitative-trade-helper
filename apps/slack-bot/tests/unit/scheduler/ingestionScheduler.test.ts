import { describe, it, expect, vi } from 'vitest'
import {
  isUsEasternDst,
  nextUsIngestionRun,
  usIngestionTriggerUtc,
  zonedOffsetMinutes,
  startUsIngestionScheduler,
} from '../../../src/scheduler/ingestionScheduler.js'

describe('scheduler: U.S. ingestion timing', () => {
  it('fires at 13:00 UTC (21:00 Taipei) when U.S. Eastern DST is active', () => {
    const now = new Date('2026-07-15T05:00:00Z') // summer, before the trigger
    expect(isUsEasternDst(now)).toBe(true)

    const next = nextUsIngestionRun(now)
    expect(next.toISOString()).toBe('2026-07-15T13:00:00.000Z')
    // 13:00 UTC + 8h Taipei = 21:00 Taipei
    expect(zonedOffsetMinutes(next, 'Asia/Taipei')).toBe(480)
  })

  it('fires at 14:00 UTC (22:00 Taipei) when U.S. Eastern DST is inactive', () => {
    const now = new Date('2026-01-15T05:00:00Z') // winter, before the trigger
    expect(isUsEasternDst(now)).toBe(false)

    const next = nextUsIngestionRun(now)
    expect(next.toISOString()).toBe('2026-01-15T14:00:00.000Z')
  })

  it('detects DST via the America/New_York zone, not a hardcoded date table', () => {
    // 2026 spring-forward: 02:00 EST → 03:00 EDT on 2026-03-08 (07:00 UTC).
    expect(isUsEasternDst(new Date('2026-03-08T06:00:00Z'))).toBe(false) // 01:00 ET, still EST
    expect(isUsEasternDst(new Date('2026-03-08T07:00:00Z'))).toBe(true) // 03:00 ET, now EDT
    expect(usIngestionTriggerUtc(new Date('2026-03-08T20:00:00Z')).toISOString()).toBe(
      '2026-03-08T13:00:00.000Z'
    )
  })

  it('advances to the next ET day once today’s trigger has passed', () => {
    const now = new Date('2026-07-15T18:00:00Z') // after the 13:00 UTC trigger
    expect(nextUsIngestionRun(now).toISOString()).toBe('2026-07-16T13:00:00.000Z')
  })
})

describe('scheduler: start and reschedule', () => {
  it('schedules onTrigger at the next-run delay and reschedules after firing', async () => {
    const timers: Array<{ cb: () => void; ms: number }> = []
    const onTrigger = vi.fn().mockResolvedValue(undefined)

    const handle = startUsIngestionScheduler({
      clock: () => new Date('2026-07-15T05:00:00Z'),
      onTrigger,
      setTimer: ((cb: () => void, ms: number) => {
        timers.push({ cb, ms })
        return timers.length as unknown as ReturnType<typeof setTimeout>
      }) as never,
      clearTimer: () => undefined,
    })

    expect(timers).toHaveLength(1)
    expect(timers[0].ms).toBe(8 * 60 * 60 * 1000) // 13:00 - 05:00 = 8h

    timers[0].cb() // fire the trigger
    await new Promise((r) => setImmediate(r)) // let the async onTrigger settle

    expect(onTrigger).toHaveBeenCalledOnce()
    expect(timers).toHaveLength(2) // rescheduled the next run
    handle.stop()
  })

  it('keeps running (reschedules) even when onTrigger throws', async () => {
    const timers: Array<{ cb: () => void; ms: number }> = []
    const onTrigger = vi.fn().mockRejectedValue(new Error('ingest blew up'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const handle = startUsIngestionScheduler({
      clock: () => new Date('2026-01-15T05:00:00Z'),
      onTrigger,
      setTimer: ((cb: () => void, ms: number) => {
        timers.push({ cb, ms })
        return timers.length as unknown as ReturnType<typeof setTimeout>
      }) as never,
      clearTimer: () => undefined,
    })

    timers[0].cb()
    await new Promise((r) => setImmediate(r))

    expect(onTrigger).toHaveBeenCalledOnce()
    expect(timers).toHaveLength(2) // failure did not stop the scheduler
    errSpy.mockRestore()
    handle.stop()
  })
})
