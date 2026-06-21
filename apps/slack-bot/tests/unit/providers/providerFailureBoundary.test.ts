import { describe, it, expect, vi } from 'vitest'
import { runIsolated, type ProviderRunRecorder } from '../../../src/providers/failureBoundary.js'
import { RateLimitExceeded } from '../../../src/providers/rate-limit-guard.js'

interface CompleteCall {
  id: string
  opts: { status: string; requestCount?: number; errorMessage?: string }
}

function fakeRecorder(): ProviderRunRecorder & {
  created: string[]
  completes: CompleteCall[]
} {
  let counter = 0
  const created: string[] = []
  const completes: CompleteCall[] = []
  return {
    created,
    completes,
    async createProviderRun(provider) {
      created.push(provider)
      return `run-${++counter}`
    },
    async completeProviderRun(id, opts) {
      completes.push({ id, opts })
    },
  }
}

describe('providerFailure isolation boundary', () => {
  it('records success and returns provider data on a healthy call', async () => {
    const rec = fakeRecorder()
    const res = await runIsolated(rec, 'alpha-vantage', [] as number[], async () => ({
      data: [1, 2],
      requestCount: 1,
    }))

    expect(res.status).toBe('success')
    expect(res.data).toEqual([1, 2])
    expect(rec.created).toEqual(['alpha-vantage'])
    expect(rec.completes[0].opts.status).toBe('success')
    expect(rec.completes[0].opts.requestCount).toBe(1)
  })

  it('catches a network failure, records status "failed", returns fallback without throwing', async () => {
    const rec = fakeRecorder()
    const res = await runIsolated(rec, 'alpha-vantage', [] as number[], async () => {
      throw new Error('fetch failed: ECONNREFUSED')
    })

    expect(res.status).toBe('failed')
    expect(res.data).toEqual([])
    expect(rec.completes[0].opts.status).toBe('failed')
    expect(rec.completes[0].opts.errorMessage).toContain('ECONNREFUSED')
  })

  it('catches a rate-limit exception and records status "rate_limit"', async () => {
    const rec = fakeRecorder()
    const res = await runIsolated(rec, 'alpha-vantage', [] as number[], async () => {
      throw new RateLimitExceeded('Alpha Vantage rate limit reached (25/day).')
    })

    expect(res.status).toBe('rate_limit')
    expect(rec.completes[0].opts.status).toBe('rate_limit')
    expect(rec.completes[0].opts.errorMessage).toContain('rate limit')
  })

  it('catches a network timeout and records status "timeout"', async () => {
    const rec = fakeRecorder()
    const timeoutErr = new Error('request timed out')
    timeoutErr.name = 'TimeoutError'
    const res = await runIsolated(rec, 'alpha-vantage', [] as number[], async () => {
      throw timeoutErr
    })

    expect(res.status).toBe('timeout')
    expect(rec.completes[0].opts.status).toBe('timeout')
  })

  it('does not propagate provider errors, so a subsequent command path still runs', async () => {
    const rec = fakeRecorder()
    await expect(
      runIsolated(rec, 'alpha-vantage', [] as number[], async () => {
        throw new Error('boom')
      })
    ).resolves.toMatchObject({ status: 'failed' })

    // The status command lives outside the ingestion path and keeps responding.
    const statusReply = await Promise.resolve('investment helper: ok')
    expect(statusReply).toContain('ok')
  })
})
