import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'
import { writeWikiPage, appendToLog, updateIndex, type WikiFrontmatter } from '../../../src/orchestration/wikiWriter.js'

const BASE_FM: WikiFrontmatter = {
  title: 'Test Article',
  type: 'news_summary',
  date: new Date('2026-05-01T00:00:00Z'),
  sourceCount: 1,
  tickers: ['VOO'],
  markets: ['US'],
  assetClasses: ['us_equities'],
  riskTags: ['geopolitical'],
  confidence: 'medium',
  lastUpdated: new Date('2026-05-01T00:00:00Z'),
}

// ─── writeWikiPage ─────────────────────────────────────────────────────────────

describe('writeWikiPage', () => {
  it('creates wiki page with all required frontmatter fields', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      writeWikiPage('src-001', BASE_FM, undefined, dir)
      const text = readFileSync(resolve(dir, 'news', 'src-001.md'), 'utf-8')
      expect(text).toContain('title: Test Article')
      expect(text).toContain('type: news_summary')
      expect(text).toContain('date: 2026-05-01')
      expect(text).toContain('source_count: 1')
      expect(text).toContain('tickers: [VOO]')
      expect(text).toContain('markets: [US]')
      expect(text).toContain('asset_classes: [us_equities]')
      expect(text).toContain('risk_tags: [geopolitical]')
      expect(text).toContain('confidence: medium')
      expect(text).toContain('last_updated: 2026-05-01')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('wraps frontmatter in --- delimiters', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      writeWikiPage('src-001', BASE_FM, undefined, dir)
      const text = readFileSync(resolve(dir, 'news', 'src-001.md'), 'utf-8')
      expect(text.startsWith('---\n')).toBe(true)
      expect(text).toContain('\n---\n')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('includes summary section when provided', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      writeWikiPage('src-002', BASE_FM, 'Article summary text.', dir)
      const text = readFileSync(resolve(dir, 'news', 'src-002.md'), 'utf-8')
      expect(text).toContain('## Summary')
      expect(text).toContain('Article summary text.')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('omits summary section when not provided', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      writeWikiPage('src-003', BASE_FM, undefined, dir)
      const text = readFileSync(resolve(dir, 'news', 'src-003.md'), 'utf-8')
      expect(text).not.toContain('## Summary')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('quotes title containing colon-space to prevent YAML parse errors', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      writeWikiPage('src-005', { ...BASE_FM, title: 'Fed Decision: Rate Hike Ahead' }, undefined, dir)
      const text = readFileSync(resolve(dir, 'news', 'src-005.md'), 'utf-8')
      expect(text).toContain('title: "Fed Decision: Rate Hike Ahead"')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('handles empty tickers and risk_tags as []', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      writeWikiPage('src-004', { ...BASE_FM, tickers: [], riskTags: [] }, undefined, dir)
      const text = readFileSync(resolve(dir, 'news', 'src-004.md'), 'utf-8')
      expect(text).toContain('tickers: []')
      expect(text).toContain('risk_tags: []')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ─── appendToLog ──────────────────────────────────────────────────────────────

describe('appendToLog', () => {
  it('creates log.md and appends entry', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      appendToLog('src-001', 'Article One', dir)
      const text = readFileSync(resolve(dir, 'log.md'), 'utf-8')
      expect(text).toContain('src-001')
      expect(text).toContain('Article One')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('each call adds exactly one new line', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      appendToLog('s1', 'T1', dir)
      const lines1 = readFileSync(resolve(dir, 'log.md'), 'utf-8').split('\n').filter(Boolean).length
      appendToLog('s2', 'T2', dir)
      const lines2 = readFileSync(resolve(dir, 'log.md'), 'utf-8').split('\n').filter(Boolean).length
      expect(lines2).toBe(lines1 + 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('appends even on reingest with same sourceId — two log entries', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      appendToLog('dup-id', 'Dup Title', dir)
      appendToLog('dup-id', 'Dup Title', dir)
      const text = readFileSync(resolve(dir, 'log.md'), 'utf-8')
      const count = (text.match(/dup-id/g) ?? []).length
      expect(count).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ─── updateIndex ──────────────────────────────────────────────────────────────

describe('updateIndex', () => {
  it('creates index.md on first call', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      updateIndex('src-001', 'Article One', 'US', dir)
      expect(existsSync(resolve(dir, 'index.md'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not duplicate entry on reingest — idempotent', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      updateIndex('src-001', 'Article One', 'US', dir)
      updateIndex('src-001', 'Article One', 'US', dir)
      const text = readFileSync(resolve(dir, 'index.md'), 'utf-8')
      const count = (text.match(/src-001/g) ?? []).length
      expect(count).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('adds different sources as separate entries', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      updateIndex('src-001', 'Article One', 'US', dir)
      updateIndex('src-002', 'Article Two', 'TW', dir)
      const text = readFileSync(resolve(dir, 'index.md'), 'utf-8')
      expect(text).toContain('src-001')
      expect(text).toContain('src-002')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('entry links to news/{sourceId}.md', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'wiki-test-'))
    try {
      updateIndex('src-abc', 'My Article', 'TW', dir)
      const text = readFileSync(resolve(dir, 'index.md'), 'utf-8')
      expect(text).toContain('news/src-abc.md')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
