import { fileURLToPath } from 'url'

// GLOBAL events affect TW/Asia holdings — count against the TW budget
export type AlertMarket = 'TW' | 'US' | 'GLOBAL'

export interface DayBudget {
  tw: number
  us: number
}

export interface BudgetResult {
  decision: 'post' | 'suppress'
  reason?: 'budget_exceeded'
}

export const STANDARD_CAP = 3
export const SEVERITY5_CAP = 5

export function emptyBudget(): DayBudget {
  return { tw: 0, us: 0 }
}

function budgetKey(market: AlertMarket): 'tw' | 'us' {
  return market === 'US' ? 'us' : 'tw'
}

export function checkBudget(budget: DayBudget, market: AlertMarket, severity: number): BudgetResult {
  const count = budget[budgetKey(market)]
  if (count < STANDARD_CAP) return { decision: 'post' }
  if (count < SEVERITY5_CAP && severity === 5) return { decision: 'post' }
  return { decision: 'suppress', reason: 'budget_exceeded' }
}

export function incrementBudget(budget: DayBudget, market: AlertMarket): DayBudget {
  const key = budgetKey(market)
  return { ...budget, [key]: budget[key] + 1 }
}

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename && process.argv.includes('--simulate')) {
  const simIdx = process.argv.indexOf('--simulate')
  const rawMarket = (process.argv[simIdx + 1] ?? '').toUpperCase()
  const count = parseInt(process.argv[simIdx + 2] ?? '0', 10)
  const severity = parseInt(process.argv[simIdx + 3] ?? '3', 10)

  if (!['TW', 'US'].includes(rawMarket) || isNaN(count) || count < 1) {
    console.error('Usage: alertBudget.ts --simulate <tw|us> <count> [severity=3]')
    process.exit(1)
  }

  const market = rawMarket as AlertMarket
  let budget = emptyBudget()
  for (let i = 1; i <= count; i++) {
    const result = checkBudget(budget, market, severity)
    const label = result.decision === 'post' ? 'ALLOWED' : `SUPPRESSED (${result.reason ?? ''})`
    console.log(`Alert ${i}: ${label}`)
    if (result.decision === 'post') {
      budget = incrementBudget(budget, market)
    }
  }
}
