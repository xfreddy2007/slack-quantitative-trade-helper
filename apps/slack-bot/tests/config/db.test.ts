import { describe, it, expect, vi, afterEach } from 'vitest'

// ─── Prisma singleton ──────────────────────────────────────────────────────────

describe('getPrismaClient', () => {
  it('returns the same instance on repeated calls', async () => {
    const { getPrismaClient } = await import('../../src/db/prismaClient.js')
    const a = getPrismaClient()
    const b = getPrismaClient()
    expect(a).toBe(b)
  })
})

// ─── shutdown ─────────────────────────────────────────────────────────────────

describe('shutdown', () => {
  it('disconnects the Prisma client', async () => {
    const { getPrismaClient, shutdown } = await import('../../src/db/prismaClient.js')
    const client = getPrismaClient()
    const spy = vi.spyOn(client, '$disconnect').mockResolvedValue()
    await shutdown()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('is idempotent — safe to call when no client exists', async () => {
    const { shutdown } = await import('../../src/db/prismaClient.js')
    await shutdown()
    await expect(shutdown()).resolves.toBeUndefined()
  })
})

// ─── SIGTERM signal handler ────────────────────────────────────────────────────
// The registered handler calls the module-internal shutdown() directly, so we
// verify the observable effect: $disconnect is called on the Prisma instance.

describe('signal handling', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls $disconnect on SIGTERM', async () => {
    const { getPrismaClient } = await import('../../src/db/prismaClient.js')
    const client = getPrismaClient()
    const disconnectSpy = vi.spyOn(client, '$disconnect').mockResolvedValue()
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    process.emit('SIGTERM')
    await new Promise((r) => setTimeout(r, 20))

    expect(disconnectSpy).toHaveBeenCalled()
    exitSpy.mockRestore()
    disconnectSpy.mockRestore()
  })

  it('calls $disconnect on SIGINT', async () => {
    const { getPrismaClient } = await import('../../src/db/prismaClient.js')
    const client = getPrismaClient()
    const disconnectSpy = vi.spyOn(client, '$disconnect').mockResolvedValue()
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    process.emit('SIGINT')
    await new Promise((r) => setTimeout(r, 20))

    expect(disconnectSpy).toHaveBeenCalled()
    exitSpy.mockRestore()
    disconnectSpy.mockRestore()
  })
})

// ─── Prisma connectivity (integration — skipped if DB unavailable) ────────────

const SKIP_PATTERNS = ['ECONNREFUSED', 'P1001', 'P1013', 'DATABASE_URL', 'Can\'t reach database server']

function isDbUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return SKIP_PATTERNS.some((p) => msg.includes(p))
}

describe('checkConnectivity', () => {
  it('reads schema_versions table from local PostgreSQL', async () => {
    const { checkConnectivity, getPrismaClient, shutdown } = await import('../../src/db/prismaClient.js')
    try {
      await checkConnectivity()
      const db = getPrismaClient()
      const rows = await db.schemaVersion.findMany({ take: 1 })
      expect(Array.isArray(rows)).toBe(true)
      await shutdown()
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })
})
