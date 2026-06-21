import type { PrismaClient, DailyRecommendation, PortfolioSnapshot } from '@prisma/client'

export class DailyRecommendationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findLatest(market?: string): Promise<DailyRecommendation | null> {
    return this.db.dailyRecommendation.findFirst({
      where: market ? { market } : undefined,
      orderBy: [{ recommendationDate: 'desc' }, { createdAt: 'desc' }],
    })
  }

  async findForDateRange(market: string, start: Date, end: Date): Promise<DailyRecommendation | null> {
    return this.db.dailyRecommendation.findFirst({
      where: { market, recommendationDate: { gte: start, lt: end } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findPortfolioSnapshot(id: string): Promise<PortfolioSnapshot | null> {
    return this.db.portfolioSnapshot.findUnique({ where: { id } })
  }
}
