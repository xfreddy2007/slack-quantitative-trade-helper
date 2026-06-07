import type { PrismaClient } from '@prisma/client'
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
}
