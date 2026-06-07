import { PrismaClient } from '@prisma/client'

let instance: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!instance) {
    instance = new PrismaClient()
  }
  return instance
}

export async function shutdown(): Promise<void> {
  if (instance) {
    await instance.$disconnect()
    instance = null
  }
}

export async function checkConnectivity(): Promise<void> {
  const db = getPrismaClient()
  await db.$connect()
}

const handleSignal = async () => {
  try {
    await shutdown()
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', handleSignal)
process.on('SIGINT', handleSignal)
