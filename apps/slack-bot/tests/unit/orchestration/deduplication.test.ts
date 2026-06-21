import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { NormalizedNewsItem } from '../../../src/providers/adapter.js'
import { deduplicate } from '../../../src/orchestration/deduplication.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, '../../../../../packages/fixtures/news')

function loadFixture(name: string): NormalizedNewsItem {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf-8')) as NormalizedNewsItem
}

describe('deduplicate', () => {
  it('passes through unique items unchanged', () => {
    const items = [loadFixture('tw-market-news.json'), loadFixture('us-market-news.json')]
    const { kept, suppressed } = deduplicate(items)
    expect(kept).toHaveLength(2)
    expect(suppressed).toHaveLength(0)
  })

  it('suppresses exact URL duplicate', () => {
    const item = loadFixture('tw-market-news.json')
    const { kept, suppressed } = deduplicate([item, { ...item }])
    expect(kept).toHaveLength(1)
    expect(suppressed).toHaveLength(1)
    expect(suppressed[0].reason).toBe('duplicate')
  })

  it('suppresses title-similar duplicate (duplicate-a and duplicate-b)', () => {
    const a = loadFixture('duplicate-a.json')
    const b = loadFixture('duplicate-b.json')
    const { kept, suppressed } = deduplicate([a, b])
    expect(kept).toHaveLength(1)
    expect(suppressed).toHaveLength(1)
    expect(suppressed[0].reason).toBe('duplicate')
    expect(kept[0].source_url).toBe(a.source_url)
  })

  it('keeps first item when duplicates encountered', () => {
    const a = loadFixture('duplicate-a.json')
    const b = loadFixture('duplicate-b.json')
    const { kept } = deduplicate([a, b])
    expect(kept[0]).toEqual(a)
    expect(kept[0]).not.toEqual(b)
  })

  it('returns suppressed items in separate array — nothing silently discarded', () => {
    const a = loadFixture('duplicate-a.json')
    const b = loadFixture('duplicate-b.json')
    const { kept, suppressed } = deduplicate([a, b])
    expect(kept.length + suppressed.length).toBe(2)
  })

  it('empty input returns empty result', () => {
    const { kept, suppressed } = deduplicate([])
    expect(kept).toHaveLength(0)
    expect(suppressed).toHaveLength(0)
  })

  it('does not flag distinct-title items as duplicates', () => {
    const items = [
      loadFixture('tw-market-news.json'),
      loadFixture('us-market-news.json'),
      loadFixture('geopolitical-shock.json'),
      loadFixture('low-confidence-noise.json'),
    ]
    const { kept, suppressed } = deduplicate(items)
    expect(kept).toHaveLength(4)
    expect(suppressed).toHaveLength(0)
  })
})
