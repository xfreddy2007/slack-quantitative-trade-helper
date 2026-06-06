import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

export function computeUrlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex')
}

export interface UpsertSourceInput {
  provider: string
  url: string
  title: string
  publishedAt?: Date
  author?: string
  licensePolicy?: string
  content: string
  contentType?: string
}

export interface UpsertSourceResult {
  sourceId: string
  isNew: boolean
}

export class SourceRepository {
  constructor(private readonly db: PrismaClient) {}

  async createProviderRun(provider: string): Promise<string> {
    const run = await this.db.providerRun.create({
      data: { provider, status: 'running' },
    })
    return run.id
  }

  async completeProviderRun(
    id: string,
    opts: { status: string; requestCount?: number; errorMessage?: string }
  ): Promise<void> {
    await this.db.providerRun.update({
      where: { id },
      data: {
        status: opts.status,
        completedAt: new Date(),
        requestCount: opts.requestCount ?? 0,
        ...(opts.errorMessage != null && { errorMessage: opts.errorMessage }),
      },
    })
  }

  async upsertSource(input: UpsertSourceInput): Promise<UpsertSourceResult> {
    const hash = computeUrlHash(input.url)
    try {
      const source = await this.db.source.create({
        data: {
          provider: input.provider,
          url: input.url,
          title: input.title,
          publishedAt: input.publishedAt ?? null,
          author: input.author ?? null,
          licensePolicy: input.licensePolicy ?? null,
          hash,
          documents: {
            create: {
              content: input.content,
              contentType: input.contentType ?? 'text/plain',
            },
          },
        },
      })
      return { sourceId: source.id, isNew: true }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.db.source.findUnique({ where: { hash } })
        if (existing) return { sourceId: existing.id, isNew: false }
      }
      throw err
    }
  }

  async setRawPath(sourceId: string, rawPath: string): Promise<void> {
    await this.db.source.update({
      where: { id: sourceId },
      data: { rawPath },
    })
  }
}
