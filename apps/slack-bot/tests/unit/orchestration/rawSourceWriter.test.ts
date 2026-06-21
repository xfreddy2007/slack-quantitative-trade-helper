import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'
import { writeRawSource } from '../../../src/orchestration/rawSourceWriter.js'

describe('writeRawSource', () => {
  it('creates file at {dir}/{sourceId}.md with title and content', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'raw-source-test-'))
    try {
      const path = writeRawSource(
        'test-id-123',
        'Article body here.',
        { title: 'Test Title', url: 'https://example.com/article', provider: 'fixture' },
        dir
      )
      expect(existsSync(path)).toBe(true)
      const text = readFileSync(path, 'utf-8')
      expect(text).toContain('# Test Title')
      expect(text).toContain('https://example.com/article')
      expect(text).toContain('Article body here.')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns path equal to {dir}/{sourceId}.md', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'raw-source-test-'))
    try {
      const path = writeRawSource('abc', 'content', { title: 'T', url: 'https://x.com', provider: 'p' }, dir)
      expect(path).toBe(resolve(dir, 'abc.md'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('includes publishedAt when provided', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'raw-source-test-'))
    try {
      const path = writeRawSource(
        'id1',
        'body',
        {
          title: 'T',
          url: 'https://x.com',
          provider: 'p',
          publishedAt: new Date('2026-05-01T00:00:00Z'),
        },
        dir
      )
      const text = readFileSync(path, 'utf-8')
      expect(text).toContain('2026-05-01')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('includes provider in metadata', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'raw-source-test-'))
    try {
      const path = writeRawSource('id2', 'body', { title: 'T', url: 'https://x.com', provider: 'alpha-vantage' }, dir)
      const text = readFileSync(path, 'utf-8')
      expect(text).toContain('alpha-vantage')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not overwrite existing file — raw sources are immutable', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'raw-source-test-'))
    try {
      writeRawSource('id3', 'original content', { title: 'T', url: 'https://x.com', provider: 'p' }, dir)
      writeRawSource('id3', 'new content', { title: 'T', url: 'https://x.com', provider: 'p' }, dir)
      const text = readFileSync(resolve(dir, 'id3.md'), 'utf-8')
      expect(text).toContain('original content')
      expect(text).not.toContain('new content')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
