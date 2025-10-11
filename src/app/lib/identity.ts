import { prisma } from '../../lib/db';

function randSuffix() {
  return Math.random().toString(16).slice(2, 6);
}

export async function ensureSessionProfile(sessionId: string) {
  let p = await prisma.sessionProfile.findUnique({ where: { sessionId } });
  if (p) return p;
  const handle = `nab-${randSuffix()}`;
  return prisma.sessionProfile.create({ data: { sessionId, handle } });
}

export async function getProfileByHandle(handle: string) {
  return prisma.sessionProfile.findUnique({ where: { handle } });
}
