import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { NormalizedNewsItem } from '../../../src/providers/adapter.js'
import { classifyMarket, classifyAll } from '../../../src/orchestration/marketClassifier.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, '../../../../../packages/fixtures/news')

function loadFixture(name: string): NormalizedNewsItem {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8')) as NormalizedNewsItem
}

describe('classifyMarket', () => {
  it('classifies TW market news as TW', () => {
    const item = loadFixture('tw-market-news.json')
    expect(classifyMarket(item)).toBe('TW')
  })

  it('classifies US market news as US', () => {
    const item = loadFixture('us-market-news.json')
    expect(classifyMarket(item)).toBe('US')
  })

  it('classifies geopolitical shock as GLOBAL', () => {
    const item = loadFixture('geopolitical-shock.json')
    expect(classifyMarket(item)).toBe('GLOBAL')
  })

  it('classifies low-confidence noise — passes through without filtering', () => {
    const item = loadFixture('low-confidence-noise.json')
    const result = classifyMarket(item)
    expect(['TW', 'US', 'GLOBAL']).toContain(result)
  })

  it('falls back to existing market when no signals detected', () => {
    const item: NormalizedNewsItem = {
      title: 'Generic headline',
      source_url: 'https://example.com/generic',
      market: 'US',
      published_at: '2026-05-29T00:00:00.000Z',
      content: 'No market-specific signals here.',
    }
    expect(classifyMarket(item)).toBe('US')
  })
})

describe('classifyAll', () => {
  it('returns same count as input', () => {
    const items = [
      loadFixture('tw-market-news.json'),
      loadFixture('us-market-news.json'),
    ]
    expect(classifyAll(items)).toHaveLength(2)
  })

  it('does not mutate original items', () => {
    const item = loadFixture('tw-market-news.json')
    const original = { ...item }
    classifyAll([item])
    expect(item).toEqual(original)
  })
})
