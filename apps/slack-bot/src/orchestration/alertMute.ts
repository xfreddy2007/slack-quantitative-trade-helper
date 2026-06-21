export interface MuteResult {
  decision: 'post' | 'suppress'
  reason?: 'muted'
}

export function checkMute(mutedTargets: string[], alertTargets: string[]): MuteResult {
  const normalizedMuted = new Set(mutedTargets.map((t) => t.toLowerCase()))
  const isMuted = alertTargets.some((target) => normalizedMuted.has(target.toLowerCase()))
  if (isMuted) return { decision: 'suppress', reason: 'muted' }
  return { decision: 'post' }
}
