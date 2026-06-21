import { describe, it, expect } from 'vitest'
import {
  parsePipelineOutput,
  assertRequiredSections,
  QualityGateError,
  REQUIRED_SECTIONS,
} from '../../../src/orchestration/qualityGate.js'

describe('quality-gate parsePipelineOutput', () => {
  it('extracts the daily recommendation id and all paper recommendation ids', () => {
    const stdout = [
      '=== Stage 5: Daily recommendation ===',
      'daily_recommendation_id: dr-123',
      'paper_recommendation_id: pr-1',
      'paper_recommendation_id: pr-2',
    ].join('\n')

    const result = parsePipelineOutput(stdout)
    expect(result.dailyRecommendationId).toBe('dr-123')
    expect(result.paperRecommendationIds).toEqual(['pr-1', 'pr-2'])
  })

  it('returns null/empty when the pipeline produced no records', () => {
    const result = parsePipelineOutput('pipeline ran but wrote nothing')
    expect(result.dailyRecommendationId).toBeNull()
    expect(result.paperRecommendationIds).toEqual([])
  })
})

describe('quality-gate assertRequiredSections', () => {
  it('passes when every required section is present', () => {
    const rendered = `今日觀察…\n可考慮調整…\n不建議動作…`
    expect(assertRequiredSections(rendered)).toBe(true)
  })

  it('throws a QualityGateError naming the missing sections', () => {
    try {
      assertRequiredSections('今日觀察 only')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(QualityGateError)
      expect((err as QualityGateError).step).toBe('render')
      expect((err as QualityGateError).message).toContain('可考慮調整')
      expect((err as QualityGateError).message).toContain('不建議動作')
    }
  })

  it('exposes the three required sections', () => {
    expect(REQUIRED_SECTIONS).toEqual(['今日觀察', '可考慮調整', '不建議動作'])
  })
})
