import type { PrismaClient, PaperRecommendation } from '@prisma/client'

export class PaperRecommendationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findRecent(limit = 10): Promise<PaperRecommendation[]> {
    return this.db.paperRecommendation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async findById(id: string): Promise<PaperRecommendation | null> {
    return this.db.paperRecommendation.findUnique({ where: { id } })
  }
}
