import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DEFAULT_RAW_NEWS_DIR = resolve(__dirname, '../../../../knowledge/raw/news')

export interface RawSourceMeta {
  title: string
  url: string
  provider: string
  publishedAt?: Date
}

export function writeRawSource(
  sourceId: string,
  content: string,
  meta: RawSourceMeta,
  rawNewsDir?: string
): string {
  const dir = rawNewsDir ?? DEFAULT_RAW_NEWS_DIR
  mkdirSync(dir, { recursive: true })

  const date = (meta.publishedAt ?? new Date()).toISOString()
  const markdown = [
    `# ${meta.title}`,
    '',
    `- **URL**: ${meta.url}`,
    `- **Provider**: ${meta.provider}`,
    `- **Published**: ${date}`,
    '',
    content,
    '',
  ].join('\n')

  const filePath = resolve(dir, `${sourceId}.md`)
  if (!existsSync(filePath)) {
    writeFileSync(filePath, markdown, 'utf-8')
  }
  return filePath
}
