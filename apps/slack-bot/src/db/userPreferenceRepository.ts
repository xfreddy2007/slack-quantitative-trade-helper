import type { PrismaClient, UserPreference } from '@prisma/client'

export class UserPreferenceRepository {
  constructor(private readonly db: PrismaClient) {}

  async mute(target: string): Promise<UserPreference> {
    return this.db.userPreference.upsert({
      where: { type_target: { type: 'mute', target } },
      create: { type: 'mute', target },
      update: { type: 'mute', target },
    })
  }

  async findMutedTargets(): Promise<string[]> {
    const preferences = await this.db.userPreference.findMany({
      where: { type: 'mute' },
      select: { target: true },
    })
    return preferences.map((p) => p.target)
  }
}
