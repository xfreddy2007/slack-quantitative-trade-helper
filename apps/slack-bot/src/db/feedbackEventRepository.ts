import type { PrismaClient, FeedbackEvent } from '@prisma/client'

export class FeedbackEventRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(paperRecommendationId: string, feedback: string): Promise<FeedbackEvent> {
    return this.db.feedbackEvent.create({
      data: { paperRecommendationId, feedback },
    })
  }
}
