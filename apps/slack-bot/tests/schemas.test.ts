import { describe, it, expect } from 'vitest'
import { MarketEnum, ActionEnum, RecommendationPayloadSchema, ProviderSourcePayloadSchema } from '@schemas/zod'

describe('MarketEnum', () => {
  it('accepts TW, US, GLOBAL', () => {
    expect(MarketEnum.parse('TW')).toBe('TW')
    expect(MarketEnum.parse('US')).toBe('US')
    expect(MarketEnum.parse('GLOBAL')).toBe('GLOBAL')
  })

  it('rejects unknown market', () => {
    expect(() => MarketEnum.parse('JP')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => MarketEnum.parse('')).toThrow()
  })
})

describe('ActionEnum', () => {
  const validActions = [
    'monitor',
    'hold',
    'add_position',
    'reduce_position',
    'rebalance',
    'hedge',
    'do_not_act',
    'research_required',
  ]

  it.each(validActions)('accepts %s', (action) => {
    expect(ActionEnum.parse(action)).toBe(action)
  })

  it('rejects unknown action', () => {
    expect(() => ActionEnum.parse('sell_all')).toThrow()
  })

  it('has exactly 8 values', () => {
    expect(ActionEnum.options).toHaveLength(8)
  })
})

describe('RecommendationPayloadSchema', () => {
  const valid = {
    id: 'rec-001',
    market: 'TW' as const,
    symbol: '0050.TW',
    action: 'rebalance' as const,
    rationale: '持倉偏離目標 6%，建議調整至目標區間',
    confidence: 3,
    isPaperOnly: true as const,
    createdAt: '2026-05-29T08:30:00.000Z',
  }

  it('accepts valid payload', () => {
    expect(() => RecommendationPayloadSchema.parse(valid)).not.toThrow()
  })

  it('accepts optional size range fields', () => {
    const withSize = { ...valid, suggestedSizeMinPct: 3, suggestedSizeMaxPct: 5 }
    const result = RecommendationPayloadSchema.parse(withSize)
    expect(result.suggestedSizeMinPct).toBe(3)
  })

  it('rejects confidence outside 1-5', () => {
    expect(() => RecommendationPayloadSchema.parse({ ...valid, confidence: 6 })).toThrow()
    expect(() => RecommendationPayloadSchema.parse({ ...valid, confidence: 0 })).toThrow()
  })

  it('rejects non-paper payload', () => {
    expect(() =>
      RecommendationPayloadSchema.parse({ ...valid, isPaperOnly: false })
    ).toThrow()
  })

  it('rejects invalid market', () => {
    expect(() => RecommendationPayloadSchema.parse({ ...valid, market: 'JP' })).toThrow()
  })
})

describe('ProviderSourcePayloadSchema', () => {
  const valid = {
    provider: 'alpha_vantage',
    url: 'https://example.com/news/1',
    title: 'Taiwan semiconductor sector update',
    retrievedAt: '2026-05-29T08:00:00.000Z',
    market: 'TW' as const,
    hash: 'abc123def456',
  }

  it('accepts valid payload', () => {
    expect(() => ProviderSourcePayloadSchema.parse(valid)).not.toThrow()
  })

  it('accepts optional fields as null', () => {
    const withNulls = { ...valid, publishedAt: null, author: null }
    expect(() => ProviderSourcePayloadSchema.parse(withNulls)).not.toThrow()
  })

  it('rejects invalid url', () => {
    expect(() =>
      ProviderSourcePayloadSchema.parse({ ...valid, url: 'not-a-url' })
    ).toThrow()
  })

  it('rejects unknown market', () => {
    expect(() => ProviderSourcePayloadSchema.parse({ ...valid, market: 'EU' })).toThrow()
  })
})
