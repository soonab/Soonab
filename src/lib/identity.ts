import { prisma } from '@/lib/db';

export async function ensureSessionProfile(sessionId: string) {
  // Keep existing behavior
  const existing = await prisma.sessionProfile.findUnique({ where: { sessionId } });
  if (existing) return existing;

  // Generate a short handle like nab-xxxx
  const suffix = Math.random().toString(36).slice(2, 6);
  const handle = `nab-${suffix}`;
  return prisma.sessionProfile.create({ data: { sessionId, handle } });
}

// NEW: prefer Profile handle; fall back to SessionProfile for legacy
export async function getProfileByHandle(handle: string) {
  const p = await prisma.profile.findUnique({ where: { handle } });
  if (p) return { profile: p, session: null };
  const s = await prisma.sessionProfile.findFirst({ where: { handle } });
  if (s) return { profile: null, session: s };
  return null;
}
