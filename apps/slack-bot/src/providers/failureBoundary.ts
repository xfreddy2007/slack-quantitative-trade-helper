import { RateLimitExceeded } from './rate-limit-guard.js'

/** Minimal slice of SourceRepository needed to record a provider run. */
export interface ProviderRunRecorder {
  createProviderRun(provider: string): Promise<string>
  completeProviderRun(
    id: string,
    opts: { status: string; requestCount?: number; errorMessage?: string }
  ): Promise<void>
}

export type IsolatedStatus = 'success' | 'rate_limit' | 'failed'

export interface IsolatedResult<T> {
  status: IsolatedStatus
  data: T
  runId: string
}

/**
 * Run an external provider call inside a failure boundary. Network failures, API errors, and
 * rate-limit exceptions are caught, recorded to `provider_runs`, and never propagated — so a
 * failing provider cannot crash the Slack app or break command handlers (e.g. `/investment status`
 * keeps responding). On failure the caller receives `fallback` as `data` and a non-success status.
 */
export async function runIsolated<T>(
  recorder: ProviderRunRecorder,
  provider: string,
  fallback: T,
  fn: () => Promise<{ data: T; requestCount?: number }>
): Promise<IsolatedResult<T>> {
  const runId = await recorder.createProviderRun(provider)
  try {
    const { data, requestCount } = await fn()
    await recorder.completeProviderRun(runId, { status: 'success', requestCount })
    return { status: 'success', data, runId }
  } catch (err) {
    // Status vocabulary follows the `provider_runs.status` schema comment:
    // rate limit → 'rate_limit'; any other failure (network/API/timeout) → 'failed'.
    const status: IsolatedStatus = err instanceof RateLimitExceeded ? 'rate_limit' : 'failed'
    const errorMessage = err instanceof Error ? err.message : String(err)
    await recorder.completeProviderRun(runId, { status, errorMessage })
    return { status, data: fallback, runId }
  }
}
