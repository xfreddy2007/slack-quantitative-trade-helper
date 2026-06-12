import type { PrismaClient, TriggerEvaluation } from '@prisma/client'
import type { TriggerScore } from '../orchestration/triggerScoring.js'

export interface TriggerVersionMeta {
  modelVersion: string
  schemaVersion: string
}

export interface UpsertTriggerResult {
  id: string
  isNew: boolean
}

export class TriggerRepository {
  constructor(private readonly db: PrismaClient) {}

  async findPriorSeverity(eventIds: string[]): Promise<number | undefined> {
    const existing = await this.db.triggerEvaluation.findFirst({
      where: { eventIds: { equals: eventIds } },
      orderBy: { createdAt: 'desc' },
      select: { severity: true },
    })
    return existing?.severity
  }

  async upsertTriggerEvaluation(
    score: TriggerScore,
    meta: TriggerVersionMeta
  ): Promise<UpsertTriggerResult> {
    if (score.isDuplicate) {
      const existing = await this.db.triggerEvaluation.findFirst({
        where: { eventIds: { equals: score.eventIds } },
        orderBy: { createdAt: 'desc' },
      })
      if (existing) return { id: existing.id, isNew: false }
    }

    const created = await this.db.triggerEvaluation.create({
      data: {
        eventIds: score.eventIds,
        portfolioSymbols: score.portfolioSymbols,
        severity: score.severity,
        confidence: score.confidence,
        novelty: score.novelty ?? null,
        relevance: score.relevance,
        suggestedAction: score.suggestedAction,
        actionSize: score.actionSize ?? null,
        rationale: score.rationale,
        humanReviewRequired: score.humanReviewRequired,
        modelVersion: meta.modelVersion,
        schemaVersion: meta.schemaVersion,
      },
    })
    return { id: created.id, isNew: true }
  }

  async findById(id: string): Promise<TriggerEvaluation | null> {
    return this.db.triggerEvaluation.findUnique({ where: { id } })
  }

  async findCitations(eventIds: string[]): Promise<string[]> {
    if (eventIds.length === 0) return []
    const analyses = await this.db.newsAnalysis.findMany({
      where: { id: { in: eventIds } },
      select: { citations: true },
    })
    return analyses.flatMap((a) => (Array.isArray(a.citations) ? (a.citations as string[]) : []))
  }
}
