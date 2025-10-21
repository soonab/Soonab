import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const required = ['Conversation','Message','DMBlock']; // DMBlock optional in some designs
  try {
    const exists = async (name: string) => {
      const res = await prisma.$queryRaw<{ reg: string | null }[]>`
        SELECT to_regclass(${`public."${name.replace(/"/g,'""')}"`}) AS reg
      `;
      return !!res[0]?.reg;
    };
    const missing: string[] = [];
    for (const t of required) {
      if (!(await exists(t))) missing.push(t);
    }
    if (missing.length) {
      console.error('❌ Missing tables:', missing.join(', '));
      process.exit(1);
    } else {
      console.log('✅ DM tables present');
    }
  } finally {
    await prisma.$disconnect();
  }
}
main();
