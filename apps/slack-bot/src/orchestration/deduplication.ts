import type { NormalizedNewsItem } from '../providers/adapter.js'

export interface DeduplicationResult {
  kept: NormalizedNewsItem[]
  suppressed: { item: NormalizedNewsItem; reason: string }[]
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (setA.size === 0 && setB.size === 0) return 1
  const intersection = [...setA].filter((w) => setB.has(w)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

const JACCARD_THRESHOLD = 0.85

export function deduplicate(items: NormalizedNewsItem[]): DeduplicationResult {
  const kept: NormalizedNewsItem[] = []
  const suppressed: { item: NormalizedNewsItem; reason: string }[] = []

  for (const item of items) {
    // URL exact match
    const urlMatch = kept.find((k) => k.source_url === item.source_url)
    if (urlMatch) {
      suppressed.push({ item, reason: 'duplicate' })
      continue
    }

    // Title similarity fallback
    const titleMatch = kept.find(
      (k) => jaccardSimilarity(k.title, item.title) >= JACCARD_THRESHOLD
    )
    if (titleMatch) {
      suppressed.push({ item, reason: 'duplicate' })
      continue
    }

    kept.push(item)
  }

  return { kept, suppressed }
}
