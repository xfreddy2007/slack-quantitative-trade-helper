import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run: export $(grep DATABASE_URL ../../.env | xargs)')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  await prisma.schemaVersion.upsert({
    where: { version: '1.0.0' },
    update: {},
    create: {
      version: '1.0.0',
      description: 'Initial schema — T1.2.1',
    },
  })
  console.log('seed: schema_versions v1.0.0 upserted')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
