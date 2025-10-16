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

export async function countPostsToday(
  sessionId: string,
  profileId?: string | null
) {
  const since = startOfUTCDay();
  const where: Prisma.PostWhereInput = {
    createdAt: { gte: since },
    OR: [
      { sessionId },
      ...(profileId ? [{ profileId }] as Prisma.PostWhereInput[] : []),
    ],
  };
  return prisma.post.count({ where });
}

export async function countRepliesToday(
  sessionId: string,
  postId?: string,
  profileId?: string | null
) {
  const since = startOfUTCDay();
  const where: Prisma.ReplyWhereInput = {
    createdAt: { gte: since },
    ...(postId ? { postId } : {}),
    OR: [
      { sessionId },
      ...(profileId ? [{ profileId }] as Prisma.ReplyWhereInput[] : []),
    ],
  };
  return prisma.reply.count({ where });
}

export async function canCreatePost(
  sessionId: string,
  profileId?: string | null
) {
  const s = await getScore({ sessionId, profileId });
  const bayes = Number(s?.bayesianMean ?? 0);
  const q = quotasForScore(bayes);

  const used = await countPostsToday(sessionId, profileId);
  if (used >= q.postsPerDay) {
    return { ok: false as const, error: 'Daily post limit reached' as const };
  }
  return { ok: true as const, quota: q };
}

/**
 * Reply quota gate.
 * Signature matches route import: canCreateReply(sid, profileId?, postId?)
 */
export async function canCreateReply(
  sessionId: string,
  profileId?: string | null,
  postId?: string
) {
  const s = await getScore({ sessionId, profileId });
  const bayes = Number(s?.bayesianMean ?? 0);
  const q = quotasForScore(bayes);

  const used = await countRepliesToday(sessionId, postId, profileId);
  if (used >= q.perThreadDaily) {
    return {
      ok: false as const,
      error: 'Per-thread daily reply limit reached' as const,
    };
  }
  return { ok: true as const, quota: q };
}

// Also export the new name so direct imports work cleanly
export async function canReply(
  sessionId: string,
  profileId?: string | null,
  postId?: string
) {
  return canCreateReply(sessionId, profileId, postId);
}
