import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PortfolioFixtureSchema } from '@schemas/zod/portfolio-fixture'
import { loadPriceFixtures, loadNewsFixtures } from '../../fixtures/loader.js'
import type { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_ROOT = resolve(__dirname, '../../../../../packages/fixtures')

type Portfolio = z.infer<typeof PortfolioFixtureSchema>

export function loadPortfolioFixture(name: string): Portfolio {
  const filePath = resolve(FIXTURES_ROOT, 'portfolios', `${name}.json`)
  return PortfolioFixtureSchema.parse(JSON.parse(readFileSync(filePath, 'utf-8')))
}

export function loadAllPriceSnapshots() {
  return loadPriceFixtures()
}

export { loadNewsFixtures }
