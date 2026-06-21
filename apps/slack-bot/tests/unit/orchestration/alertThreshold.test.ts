import { describe, it, expect } from 'vitest'
import { checkThreshold } from '../../../src/orchestration/alertThreshold.js'

describe('checkThreshold — post cases', () => {
  it('severity=4, confidence=3, relevance=3: post', () => {
    expect(checkThreshold(4, 3, 3)).toEqual({ decision: 'post' })
  })

  it('severity=4, confidence=5, relevance=5: post', () => {
    expect(checkThreshold(4, 5, 5)).toEqual({ decision: 'post' })
  })

  it('severity=5 overrides confidence check: post', () => {
    expect(checkThreshold(5, 1, 1)).toEqual({ decision: 'post' })
  })

  it('severity=5 overrides relevance check: post', () => {
    expect(checkThreshold(5, 2, 2)).toEqual({ decision: 'post' })
  })
})

describe('checkThreshold — suppress cases', () => {
  it('severity=3: suppress below_threshold', () => {
    expect(checkThreshold(3, 4, 4)).toEqual({ decision: 'suppress', reason: 'below_threshold' })
  })

  it('severity=1: suppress below_threshold', () => {
    expect(checkThreshold(1, 5, 5)).toEqual({ decision: 'suppress', reason: 'below_threshold' })
  })

  it('severity=4, confidence=2: suppress low_confidence', () => {
    expect(checkThreshold(4, 2, 4)).toEqual({ decision: 'suppress', reason: 'low_confidence' })
  })

  it('severity=4, confidence=1: suppress low_confidence', () => {
    expect(checkThreshold(4, 1, 5)).toEqual({ decision: 'suppress', reason: 'low_confidence' })
  })

  it('severity=4, confidence=3, relevance=2: suppress low_relevance', () => {
    expect(checkThreshold(4, 3, 2)).toEqual({ decision: 'suppress', reason: 'low_relevance' })
  })

  it('severity=4, confidence=3, relevance=1: suppress low_relevance', () => {
    expect(checkThreshold(4, 3, 1)).toEqual({ decision: 'suppress', reason: 'low_relevance' })
  })
})

describe('checkThreshold — low-confidence noise scenario', () => {
  it('severity=2, confidence=1: suppress below_threshold (severity check first)', () => {
    const result = checkThreshold(2, 1, 3)
    expect(result.decision).toBe('suppress')
  })
})
