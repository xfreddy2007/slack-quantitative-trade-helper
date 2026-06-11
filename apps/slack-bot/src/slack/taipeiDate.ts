const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000

/** Returns the [start, end) UTC instants bounding "today" in Asia/Taipei (UTC+8, no DST). */
export function taipeiDayRangeUtc(now: Date = new Date()): { start: Date; end: Date } {
  const taipeiNow = new Date(now.getTime() + TAIPEI_OFFSET_MS)
  const y = taipeiNow.getUTCFullYear()
  const m = taipeiNow.getUTCMonth()
  const d = taipeiNow.getUTCDate()
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - TAIPEI_OFFSET_MS)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}
