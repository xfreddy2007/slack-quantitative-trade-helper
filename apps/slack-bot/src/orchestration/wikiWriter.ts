import { writeFileSync, appendFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DEFAULT_WIKI_DIR = resolve(__dirname, '../../../../knowledge/wiki')

export interface WikiFrontmatter {
  title: string
  type: string
  date: Date
  sourceCount: number
  tickers: string[]
  markets: string[]
  assetClasses: string[]
  riskTags: string[]
  confidence: string
  lastUpdated: Date
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function yamlScalar(value: string): string {
  // Quote strings containing YAML-significant characters to prevent parse errors.
  if (/[:#\[\]{}&*!|>'"%@`\n\r]/.test(value) || value.includes(', ')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

function yamlArray(items: string[]): string {
  if (items.length === 0) return '[]'
  return `[${items.map(yamlScalar).join(', ')}]`
}

export function writeWikiPage(
  sourceId: string,
  fm: WikiFrontmatter,
  summary?: string,
  wikiDir?: string
): void {
  const dir = wikiDir ?? DEFAULT_WIKI_DIR
  const newsDir = resolve(dir, 'news')
  mkdirSync(newsDir, { recursive: true })

  const lines = [
    '---',
    `title: ${yamlScalar(fm.title)}`,
    `type: ${yamlScalar(fm.type)}`,
    `date: ${isoDate(fm.date)}`,
    `source_count: ${fm.sourceCount}`,
    `tickers: ${yamlArray(fm.tickers)}`,
    `markets: ${yamlArray(fm.markets)}`,
    `asset_classes: ${yamlArray(fm.assetClasses)}`,
    `risk_tags: ${yamlArray(fm.riskTags)}`,
    `confidence: ${fm.confidence}`,
    `last_updated: ${isoDate(fm.lastUpdated)}`,
    '---',
    '',
  ]

  if (summary) {
    lines.push('## Summary', '', summary, '')
  }

  writeFileSync(resolve(newsDir, `${sourceId}.md`), lines.join('\n'), 'utf-8')
}

export function appendToLog(sourceId: string, title: string, wikiDir?: string): void {
  const dir = wikiDir ?? DEFAULT_WIKI_DIR
  mkdirSync(dir, { recursive: true })
  const entry = `- ${new Date().toISOString()} | ${sourceId} | ${title}\n`
  appendFileSync(resolve(dir, 'log.md'), entry, 'utf-8')
}

export function updateIndex(
  sourceId: string,
  title: string,
  market: string,
  wikiDir?: string
): void {
  const dir = wikiDir ?? DEFAULT_WIKI_DIR
  mkdirSync(dir, { recursive: true })
  const indexPath = resolve(dir, 'index.md')
  const entry = `- [${title}](news/${sourceId}.md) (${market})\n`

  if (!existsSync(indexPath)) {
    writeFileSync(indexPath, `# Investment Wiki Index\n\n${entry}`, 'utf-8')
    return
  }

  const existing = readFileSync(indexPath, 'utf-8')
  if (existing.includes(sourceId)) return // idempotent — already indexed

  appendFileSync(indexPath, entry, 'utf-8')
}
