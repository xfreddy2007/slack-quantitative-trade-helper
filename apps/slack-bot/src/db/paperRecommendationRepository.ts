import type { PrismaClient, PaperRecommendation, Prisma } from '@prisma/client'

/** A paper recommendation joined with its per-horizon evaluation rows. */
export type PaperRecommendationWithEvaluations = Prisma.PaperRecommendationGetPayload<{
  include: { paperEvaluations: true }
}>

export class PaperRecommendationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findRecent(limit = 10): Promise<PaperRecommendationWithEvaluations[]> {
    return this.db.paperRecommendation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { paperEvaluations: true },
    })
  }

  async findById(id: string): Promise<PaperRecommendation | null> {
    return this.db.paperRecommendation.findUnique({ where: { id } })
  }
}
