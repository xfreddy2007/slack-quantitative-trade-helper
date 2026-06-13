import { describe, it, expect } from 'vitest'
import { checkMute } from '../../../src/orchestration/alertMute.js'

describe('checkMute', () => {
  it('no muted targets, no alert targets: post', () => {
    expect(checkMute([], [])).toEqual({ decision: 'post' })
  })

  it('alert target is muted: suppress with reason muted', () => {
    expect(checkMute(['AAPL'], ['AAPL'])).toEqual({ decision: 'suppress', reason: 'muted' })
  })

  it('alert target is not muted: post', () => {
    expect(checkMute(['AAPL'], ['MSFT'])).toEqual({ decision: 'post' })
  })

  it('multi-target overlap: suppress when any alert target is muted', () => {
    expect(checkMute(['AAPL', 'inflation'], ['MSFT', 'inflation'])).toEqual({
      decision: 'suppress',
      reason: 'muted',
    })
  })

  it('case-insensitive match: suppress when muted target differs in case from alert target', () => {
    expect(checkMute(['aapl'], ['AAPL'])).toEqual({ decision: 'suppress', reason: 'muted' })
  })
})
