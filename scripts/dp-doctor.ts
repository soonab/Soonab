import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  try {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `
    const names = tables.map(t => t.tablename).sort()
    const required = ['Conversation','Message','DMBlock']
    const missing = required.filter(r => !names.includes(r))
    console.log('Tables:', names.join(', ') || '(none)')
    if (missing.length) {
      console.error('❌ Missing tables:', missing.join(', '))
      process.exitCode = 1
    } else {
      console.log('✅ DM tables present')
    }
  } finally { await prisma.$disconnect() }
}
main()
