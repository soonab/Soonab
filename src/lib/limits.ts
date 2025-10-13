// src/lib/limits.ts
import { prisma } from '@/lib/db';
import { getScore, quotasForScore } from '@/lib/reputation';
import type { Prisma } from '@prisma/client';

// Start of the current UTC day
function startOfUTCDay(d = new Date()) {
  const x = new Date(+d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function countPostsToday(sessionId: string, profileId?: string) {
  const since = startOfUTCDay();
  const where: Prisma.PostWhereInput = {
    createdAt: { gte: since },
    OR: [{ sessionId }, ...(profileId ? [{ profileId }] : [])],
  };
  return prisma.post.count({ where });
}

export async function countRepliesToday(sessionId: string, postId?: string, profileId?: string) {
  const since = startOfUTCDay();
  const where: Prisma.ReplyWhereInput = {
    createdAt: { gte: since },
    ...(postId ? { postId } : {}),
    OR: [{ sessionId }, ...(profileId ? [{ profileId }] : [])],
  };
  return prisma.reply.count({ where });
}

export async function canCreatePost(sessionId: string, profileId?: string) {
  const s = await getScore(sessionId);
  const q = quotasForScore((s?.bayesianMean) ?? 0); // handle null score
  const used = await countPostsToday(sessionId, profileId);
  if (used >= q.postsPerDay) return { ok: false as const, error: 'Daily post limit reached' as const };
  return { ok: true as const, quota: q };
}

export async function canReply(sessionId: string, postId: string, profileId?: string) {
  const s = await getScore(sessionId);
  const q = quotasForScore((s?.bayesianMean) ?? 0);
  const used = await countRepliesToday(sessionId, postId, profileId);
  if (used >= q.perThreadDaily) return { ok: false as const, error: 'Per-thread daily reply limit reached' as const };
  return { ok: true as const, quota: q };
}
