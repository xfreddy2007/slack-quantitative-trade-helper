import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PortfolioFixtureSchema } from '@schemas/zod/portfolio-fixture'
import { PriceSnapshotFixtureSchema } from '@schemas/zod/price-snapshot-fixture'
import { NewsFixtureSchema } from '@schemas/zod/news-fixture'
import type { z } from 'zod'

type Portfolio = z.infer<typeof PortfolioFixtureSchema>
type PriceSnapshot = z.infer<typeof PriceSnapshotFixtureSchema>
type News = z.infer<typeof NewsFixtureSchema>

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_ROOT = resolve(__dirname, '../../../../packages/fixtures')

function loadJsonDir<T>(dir: string, schema: { parse(v: unknown): T }): T[] {
  const dirPath = resolve(FIXTURES_ROOT, dir)
  return readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.json'))
    .map((d) => schema.parse(JSON.parse(readFileSync(resolve(dirPath, d.name), 'utf-8'))))
}

export function loadPortfolioFixtures(): Portfolio[] {
  return loadJsonDir('portfolios', PortfolioFixtureSchema)
}

export function loadPriceFixtures(): PriceSnapshot[] {
  return loadJsonDir('prices', PriceSnapshotFixtureSchema)
}

export function loadNewsFixtures(): News[] {
  return loadJsonDir('news', NewsFixtureSchema)
}
