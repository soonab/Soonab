// src/lib/moderation.ts
import { prisma } from '@/lib/db'

export async function hasActivePostingPenalty(profileId?: string | null) {
  if (!profileId) return false // allow legacy anonymous for now
  const now = new Date()
  const active = await prisma.profilePenalty.findFirst({
    where: { profileId, resolvedAt: null, OR: [{ until: null }, { until: { gt: now } }] },
    select: { id: true },
  })
  return !!active
}
