import { describe, it, expect, afterAll, afterEach, vi } from 'vitest'
import { buildExplainMessage, createExplainCommandHandler } from '../../../../src/slack/commands/explain.js'
import { getPrismaClient, shutdown } from '../../../../src/db/prismaClient.js'
import type { CommandArgs } from '../../../../src/slack/commands/types.js'

const SKIP_PATTERNS = [
  'ECONNREFUSED',
  'P1001',
  'P1013',
  'DATABASE_URL',
  "Can't reach database server",
]

function isDbUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return SKIP_PATTERNS.some((p) => msg.includes(p))
}

const NOT_FOUND_MESSAGE = '找不到此 ID。'
const TEST_MARKER_TRIGGER = 't412-explain-command-test-trigger-rationale'
const TEST_MARKER_PAPER = 't412-explain-command-test-paper-rationale'
const TEST_CITATION_URL = 'https://example.com/article-1'

const createdSourceIds: string[] = []
const createdNewsAnalysisIds: string[] = []
const createdTriggerEvaluationIds: string[] = []
const createdPaperRecommendationIds: string[] = []
const createdSnapshotIds: string[] = []

afterEach(async () => {
  const db = getPrismaClient()
  try {
    if (createdPaperRecommendationIds.length > 0) {
      await db.paperRecommendation.deleteMany({ where: { id: { in: createdPaperRecommendationIds } } })
      createdPaperRecommendationIds.length = 0
    }
    if (createdSnapshotIds.length > 0) {
      await db.portfolioSnapshot.deleteMany({ where: { id: { in: createdSnapshotIds } } })
      createdSnapshotIds.length = 0
    }
    if (createdTriggerEvaluationIds.length > 0) {
      await db.triggerEvaluation.deleteMany({ where: { id: { in: createdTriggerEvaluationIds } } })
      createdTriggerEvaluationIds.length = 0
    }
    if (createdNewsAnalysisIds.length > 0) {
      await db.newsAnalysis.deleteMany({ where: { id: { in: createdNewsAnalysisIds } } })
      createdNewsAnalysisIds.length = 0
    }
    if (createdSourceIds.length > 0) {
      await db.source.deleteMany({ where: { id: { in: createdSourceIds } } })
      createdSourceIds.length = 0
    }
  } catch {
    // best-effort cleanup
  }
})

afterAll(async () => {
  await shutdown()
})

describe('commands/explain', () => {
  it('returns the not-found message for an unknown/garbage id without throwing', async () => {
    const db = getPrismaClient()

    try {
      const text = await buildExplainMessage(db, 'this-id-does-not-exist-garbage-123')
      expect(text).toBe(NOT_FOUND_MESSAGE)
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })

  it('returns the not-found message for an empty id', async () => {
    const db = getPrismaClient()

    const text = await buildExplainMessage(db, '')
    expect(text).toBe(NOT_FOUND_MESSAGE)
  })

  it('renders a TriggerEvaluation rationale and citations chained via NewsAnalysis', async () => {
    const db = getPrismaClient()

    try {
      const source = await db.source.create({
        data: {
          provider: 'test-provider',
          url: 'https://example.com/source-article',
          title: 't412-explain-source',
          hash: `t412-explain-source-hash-${Date.now()}`,
        },
      })
      createdSourceIds.push(source.id)

      const newsAnalysis = await db.newsAnalysis.create({
        data: {
          sourceId: source.id,
          summary: 't412-explain-news-summary',
          tickers: [],
          topics: [],
          riskTags: [],
          assetClasses: [],
          severity: 2,
          confidence: 3,
          citations: [TEST_CITATION_URL],
        },
      })
      createdNewsAnalysisIds.push(newsAnalysis.id)

      const trigger = await db.triggerEvaluation.create({
        data: {
          eventIds: [newsAnalysis.id],
          portfolioSymbols: [],
          severity: 2,
          confidence: 3,
          relevance: 3,
          suggestedAction: 'hold',
          rationale: TEST_MARKER_TRIGGER,
        },
      })
      createdTriggerEvaluationIds.push(trigger.id)

      const text = await buildExplainMessage(db, trigger.id)

      expect(text).toContain(TEST_MARKER_TRIGGER)
      expect(text).toContain(TEST_CITATION_URL)
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })

  it('renders a PaperRecommendation rationale and chains citations via its source TriggerEvaluation', async () => {
    const db = getPrismaClient()

    try {
      const source = await db.source.create({
        data: {
          provider: 'test-provider',
          url: 'https://example.com/source-article-2',
          title: 't412-explain-source-2',
          hash: `t412-explain-source-hash-2-${Date.now()}`,
        },
      })
      createdSourceIds.push(source.id)

      const newsAnalysis = await db.newsAnalysis.create({
        data: {
          sourceId: source.id,
          summary: 't412-explain-news-summary-2',
          tickers: [],
          topics: [],
          riskTags: [],
          assetClasses: [],
          severity: 2,
          confidence: 3,
          citations: [TEST_CITATION_URL],
        },
      })
      createdNewsAnalysisIds.push(newsAnalysis.id)

      const trigger = await db.triggerEvaluation.create({
        data: {
          eventIds: [newsAnalysis.id],
          portfolioSymbols: [],
          severity: 2,
          confidence: 3,
          relevance: 3,
          suggestedAction: 'hold',
          rationale: 't412-explain-command-test-trigger-rationale-2',
        },
      })
      createdTriggerEvaluationIds.push(trigger.id)

      const snapshot = await db.portfolioSnapshot.create({
        data: { snapshotDate: new Date() },
      })
      createdSnapshotIds.push(snapshot.id)

      const paperRecommendation = await db.paperRecommendation.create({
        data: {
          sourceType: 'trigger',
          sourceId: trigger.id,
          symbol: 'TEST.TW',
          market: 'TW',
          action: 'buy',
          rationale: TEST_MARKER_PAPER,
          confidence: 4,
          portfolioSnapshotId: snapshot.id,
        },
      })
      createdPaperRecommendationIds.push(paperRecommendation.id)

      const text = await buildExplainMessage(db, paperRecommendation.id)

      expect(text).toContain(TEST_MARKER_PAPER)
      expect(text).toContain(TEST_CITATION_URL)
    } catch (err: unknown) {
      if (isDbUnavailable(err)) {
        console.warn(
          'Skipping DB integration — PostgreSQL not reachable:',
          (err instanceof Error ? err.message : String(err)).split('\n')[0]
        )
        return
      }
      throw err
    }
  })

  it('handler responds with the not-found message for whitespace-only command text', async () => {
    const db = getPrismaClient()
    const handler = createExplainCommandHandler(db)
    const ack = vi.fn().mockResolvedValue(undefined)
    const respond = vi.fn().mockResolvedValue(undefined)

    await handler({ command: { text: '  ' }, ack, respond } as unknown as CommandArgs)

    expect(ack).toHaveBeenCalledTimes(1)
    expect(respond).toHaveBeenCalledWith({ text: NOT_FOUND_MESSAGE })
  })
})
