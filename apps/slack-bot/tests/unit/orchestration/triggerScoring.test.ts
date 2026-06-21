import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { NormalizedNewsItem } from '../../../src/providers/adapter.js'
import { scoreItem } from '../../../src/orchestration/triggerScoring.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, '../../../../../packages/fixtures/news')

function loadFixture(name: string): NormalizedNewsItem {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8')) as NormalizedNewsItem
}

describe('scoreItem — severity and relevance', () => {
  it('geopolitical shock: severity >= 4, relevance >= 3', () => {
    const item = loadFixture('geopolitical-shock.json')
    const score = scoreItem(item)
    expect(score.severity).toBeGreaterThanOrEqual(4)
    expect(score.relevance).toBeGreaterThanOrEqual(3)
  })

  it('geopolitical shock: uses expected_severity from fixture', () => {
    const item = loadFixture('geopolitical-shock.json')
    const score = scoreItem(item)
    expect(score.severity).toBe(5)
    expect(score.confidence).toBe(4)
  })

  it('TW market news: severity and relevance set correctly', () => {
    const item = loadFixture('tw-market-news.json')
    const score = scoreItem(item)
    expect(score.severity).toBe(3)
    expect(score.relevance).toBe(4)
  })

  it('US market news: relevance is 3', () => {
    const item = loadFixture('us-market-news.json')
    const score = scoreItem(item)
    expect(score.relevance).toBe(3)
  })
})

describe('scoreItem — suggestedAction', () => {
  it('geopolitical shock: reduce_position (sev>=4, conf>=3, rel>=3)', () => {
    const item = loadFixture('geopolitical-shock.json')
    const score = scoreItem(item)
    expect(score.suggestedAction).toBe('reduce_position')
  })

  it('low-confidence noise (severity=2): monitor (not research_required — sev<5)', () => {
    const item = loadFixture('low-confidence-noise.json')
    const score = scoreItem(item)
    // severity=2, confidence=1: below severity-5 threshold → monitor, not research_required
    expect(score.suggestedAction).toBe('monitor')
    expect(score.suggestedAction).not.toBe('reduce_position')
    expect(score.suggestedAction).not.toBe('do_not_act')
  })

  it('low-confidence noise: confidence <= 2', () => {
    const item = loadFixture('low-confidence-noise.json')
    const score = scoreItem(item)
    expect(score.confidence).toBeLessThanOrEqual(2)
  })

  it('severity=5 with low confidence: research_required (matches Python Rule 2)', () => {
    const item: NormalizedNewsItem = {
      title: 'Crisis',
      source_url: 'https://fixture.example.com/sev5-low-conf',
      market: 'GLOBAL',
      published_at: '2026-05-29T00:00:00.000Z',
      content: 'Critical event.',
      expected_severity: 5,
      expected_confidence: 1,
    }
    const score = scoreItem(item)
    expect(score.suggestedAction).toBe('research_required')
  })

  it('severity=3 with low confidence: monitor (not research_required — matches Python Rule 3)', () => {
    const item: NormalizedNewsItem = {
      title: 'Minor event',
      source_url: 'https://fixture.example.com/sev3-low-conf',
      market: 'US',
      published_at: '2026-05-29T00:00:00.000Z',
      content: 'Possible minor disruption.',
      expected_severity: 3,
      expected_confidence: 1,
    }
    const score = scoreItem(item)
    expect(score.suggestedAction).toBe('monitor')
  })
})

describe('scoreItem — duplicate detection', () => {
  it('same event scored twice with same severity: isDuplicate=true', () => {
    const item = loadFixture('geopolitical-shock.json')
    const first = scoreItem(item)
    const second = scoreItem(item, { priorSeverity: first.severity })
    expect(second.isDuplicate).toBe(true)
  })

  it('same event with higher severity: isDuplicate=false', () => {
    const item = loadFixture('tw-market-news.json')
    const first = scoreItem(item)
    const second = scoreItem(item, { priorSeverity: first.severity - 1 })
    expect(second.isDuplicate).toBe(false)
  })

  it('no prior score: isDuplicate=false', () => {
    const item = loadFixture('geopolitical-shock.json')
    const score = scoreItem(item)
    expect(score.isDuplicate).toBe(false)
  })
})

describe('scoreItem — humanReviewRequired', () => {
  it('high severity + low confidence: humanReviewRequired=true', () => {
    const item: NormalizedNewsItem = {
      title: 'Crisis',
      source_url: 'https://fixture.example.com/crisis',
      market: 'GLOBAL',
      published_at: '2026-05-29T00:00:00.000Z',
      content: 'Serious crisis unfolding.',
      expected_severity: 5,
      expected_confidence: 1,
    }
    const score = scoreItem(item)
    expect(score.humanReviewRequired).toBe(true)
  })

  it('normal event: humanReviewRequired=false', () => {
    const item = loadFixture('tw-market-news.json')
    const score = scoreItem(item)
    expect(score.humanReviewRequired).toBe(false)
  })
})
