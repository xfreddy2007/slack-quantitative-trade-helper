// Load .env from project root (cwd when run via e2e or npm scripts)
try { process.loadEnvFile() } catch { /* already set via environment */ }

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const row = await prisma.schemaVersion.upsert({
    where: { version: '1.0.0' },
    update: {},
    create: {
      version: '1.0.0',
      description: 'Initial schema — migration 20260529152100_init',
    },
  })
  console.log(`schema_versions: upserted id=${row.id} version=${row.version}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
