import { describe, it, expect } from 'vitest'
import {
  checkBudget,
  incrementBudget,
  emptyBudget,
  STANDARD_CAP,
  SEVERITY5_CAP,
} from '../../../src/orchestration/alertBudget.js'

describe('checkBudget — standard cap', () => {
  it('first alert always allowed', () => {
    expect(checkBudget(emptyBudget(), 'TW', 3)).toEqual({ decision: 'post' })
  })

  it(`alert ${STANDARD_CAP} is allowed (at boundary)`, () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP - 1; i++) budget = incrementBudget(budget, 'TW')
    expect(checkBudget(budget, 'TW', 3)).toEqual({ decision: 'post' })
  })

  it(`alert ${STANDARD_CAP + 1} is suppressed (standard severity)`, () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP; i++) budget = incrementBudget(budget, 'TW')
    expect(checkBudget(budget, 'TW', 3)).toEqual({ decision: 'suppress', reason: 'budget_exceeded' })
  })

  it('TW and US budgets are independent', () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP; i++) budget = incrementBudget(budget, 'TW')
    // TW exhausted, US still open
    expect(checkBudget(budget, 'US', 3)).toEqual({ decision: 'post' })
  })
})

describe('checkBudget — severity-5 override', () => {
  it(`alert ${STANDARD_CAP + 1} allowed with severity=5`, () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP; i++) budget = incrementBudget(budget, 'TW')
    expect(checkBudget(budget, 'TW', 5)).toEqual({ decision: 'post' })
  })

  it(`alert ${SEVERITY5_CAP} allowed with severity=5`, () => {
    let budget = emptyBudget()
    for (let i = 0; i < SEVERITY5_CAP - 1; i++) budget = incrementBudget(budget, 'TW')
    expect(checkBudget(budget, 'TW', 5)).toEqual({ decision: 'post' })
  })

  it(`alert ${SEVERITY5_CAP + 1} suppressed even with severity=5`, () => {
    let budget = emptyBudget()
    for (let i = 0; i < SEVERITY5_CAP; i++) budget = incrementBudget(budget, 'TW')
    expect(checkBudget(budget, 'TW', 5)).toEqual({ decision: 'suppress', reason: 'budget_exceeded' })
  })
})

describe('checkBudget — US market', () => {
  it('4th US alert suppressed', () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP; i++) budget = incrementBudget(budget, 'US')
    expect(checkBudget(budget, 'US', 3)).toEqual({ decision: 'suppress', reason: 'budget_exceeded' })
  })

  it('4th US severity-5 alert allowed', () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP; i++) budget = incrementBudget(budget, 'US')
    expect(checkBudget(budget, 'US', 5)).toEqual({ decision: 'post' })
  })
})

describe('checkBudget — GLOBAL market uses TW counter', () => {
  it('GLOBAL alert counts against TW budget', () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP; i++) budget = incrementBudget(budget, 'GLOBAL')
    // TW counter exhausted, GLOBAL 4th alert suppressed
    expect(checkBudget(budget, 'GLOBAL', 3)).toEqual({ decision: 'suppress', reason: 'budget_exceeded' })
    // US counter unaffected
    expect(checkBudget(budget, 'US', 3)).toEqual({ decision: 'post' })
    expect(budget.tw).toBe(STANDARD_CAP)
    expect(budget.us).toBe(0)
  })

  it('GLOBAL severity-5 override uses TW counter', () => {
    let budget = emptyBudget()
    for (let i = 0; i < STANDARD_CAP; i++) budget = incrementBudget(budget, 'GLOBAL')
    expect(checkBudget(budget, 'GLOBAL', 5)).toEqual({ decision: 'post' })
  })
})

describe('incrementBudget', () => {
  it('increments TW counter only', () => {
    const budget = incrementBudget(emptyBudget(), 'TW')
    expect(budget.tw).toBe(1)
    expect(budget.us).toBe(0)
  })

  it('increments US counter only', () => {
    const budget = incrementBudget(emptyBudget(), 'US')
    expect(budget.tw).toBe(0)
    expect(budget.us).toBe(1)
  })

  it('GLOBAL increments TW counter', () => {
    const budget = incrementBudget(emptyBudget(), 'GLOBAL')
    expect(budget.tw).toBe(1)
    expect(budget.us).toBe(0)
  })
})
