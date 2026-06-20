import { describe, it, expect } from 'vitest'
import type { NormalizedNewsItem } from '../../../src/providers/adapter.js'
import { scoreItem } from '../../../src/orchestration/triggerScoring.js'

/** Build a NewsFixture with no expected_* overrides so derivation runs. */
function item(overrides: Partial<NormalizedNewsItem>): NormalizedNewsItem {
  return {
    title: 'test',
    source_url: 'https://example.com/t',
    market: 'GLOBAL',
    published_at: '2025-04-07T00:00:00.000Z',
    content: 'test content',
    ...overrides,
  }
}

// T1: structural blindness to TW/US single-market events.
describe('T1 — TW/US high-severity events reach severity >= 4', () => {
  it('TAIEX record crash (TW) -> severity >= 4', () => {
    const s = scoreItem(item({
      market: 'TW',
      title: "Taiwan's TAIEX plunges nearly 10%, largest single-day drop on record",
      content: 'Record intraday plunge after the tariff shock; exporters limit-down.',
    }))
    expect(s.severity).toBeGreaterThanOrEqual(4)
  })

  it('single-stock limit-down (TW) -> severity >= 4', () => {
    const s = scoreItem(item({
      market: 'TW',
      title: 'TSMC hits limit-down as tariff exposure bites',
      content: '2330.TW falls to its daily limit-down on direct US-tariff exposure.',
    }))
    expect(s.severity).toBeGreaterThanOrEqual(4)
  })

  it('TWD sharp FX surge (TW) -> severity >= 4', () => {
    const s = scoreItem(item({
      market: 'TW',
      title: 'Taiwan dollar surges most in decades, biggest two-day move',
      content: 'The New Taiwan dollar surges most in decades, pressuring exporters.',
    }))
    expect(s.severity).toBeGreaterThanOrEqual(4)
  })

  it('benign TW record-high close stays severity 3 (no false lift)', () => {
    const s = scoreItem(item({
      market: 'TW',
      title: "Taiwan's TAIEX closes the year at a record high",
      content: 'Equities ended the year at record levels led by the AI supply chain.',
    }))
    expect(s.severity).toBe(3)
  })
})

// T2: directional gating — stop firing reduce_position on good news.
describe('T2 — reduce_position requires bearish polarity', () => {
  const bearish = [
    { title: 'Global equity crash and selloff', content: 'A sharp rout and selloff hit markets.' },
    { title: 'War breaks out; strikes rattle markets', content: 'Military strikes and war risk send equities lower.' },
    { title: 'Credit stress spreads as a major default looms', content: 'Credit stress and default fears spike volatility.' },
  ]
  for (const b of bearish) {
    it(`bearish "${b.title}" -> reduce_position`, () => {
      const s = scoreItem(item({ market: 'GLOBAL', ...b }))
      expect(s.polarity).toBe('bearish')
      expect(s.suggestedAction).toBe('reduce_position')
    })
  }

  const bullish = [
    { title: 'US-China agree to a tariff truce', content: 'Tariffs rolled back; risk assets rally on the truce.' },
    { title: '90-day tariff pause sparks historic rebound', content: 'A pause triggers a one-day rebound and rally.' },
    { title: 'US strikes trade deal frameworks; markets hit new highs', content: 'Trade deal frameworks push equities to record highs.' },
  ]
  for (const b of bullish) {
    it(`bullish "${b.title}" -> NOT reduce_position`, () => {
      const s = scoreItem(item({ market: 'GLOBAL', ...b }))
      expect(s.polarity).toBe('bullish')
      expect(s.suggestedAction).not.toBe('reduce_position')
    })
  }

  it('strong earnings -> NOT reduce_position', () => {
    const s = scoreItem(item({
      market: 'TW',
      title: 'TSMC posts record profit and raises guidance',
      content: 'A positive earnings surprise reinforces the AI capex narrative.',
    }))
    expect(s.suggestedAction).not.toBe('reduce_position')
  })
})

// T3: confidence = source reliability, graduated 1-5.
describe('T3 — confidence (reliability) is graduated across >= 3 levels', () => {
  const events: NormalizedNewsItem[] = [
    item({ market: 'US', title: 'Anonymous unverified rumor', content: 'An unconfirmed, anonymous social-media post; not corroborated.' }),
    item({ market: 'US', title: 'Possible softening', content: 'A possible slowdown; signals were not confirmed.' }),
    item({ market: 'GLOBAL', title: 'Equities slide', content: 'Markets slid on growth worries.' }),
    item({ market: 'US', title: 'Federal Reserve cuts rates by 25bp', content: 'The FOMC delivers a 25bp cut as expected.' }),
  ]
  it('yields at least 3 distinct confidence levels', () => {
    const levels = new Set(events.map((e) => scoreItem(e).confidence))
    expect(levels.size).toBeGreaterThanOrEqual(3)
  })
  it('rumor scores lower confidence than an official quantified report', () => {
    const rumor = scoreItem(events[0]).confidence
    const official = scoreItem(events[3]).confidence
    expect(rumor).toBeLessThan(official)
  })
})

// T4: evalHorizonClass tags acute shocks vs allocation drift.
describe('T4 — evalHorizonClass tagging', () => {
  it('bearish acute shock -> acute', () => {
    const s = scoreItem(item({ market: 'GLOBAL', title: 'Market crash and rout', content: 'A sharp selloff and crash.' }))
    expect(s.evalHorizonClass).toBe('acute')
  })
  it('central-bank / allocation event -> allocation', () => {
    const s = scoreItem(item({ market: 'US', title: 'Fed cuts rates a third time', content: 'A rate cut supports a year-end rally.' }))
    expect(s.evalHorizonClass).toBe('allocation')
  })
})
