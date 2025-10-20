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

export async function countMediaToday(profileId: string) {
  const since = startOfUTCDay();
  return prisma.media.count({
    where: {
      ownerProfileId: profileId,
      createdAt: { gte: since },
      status: { not: 'DELETED' },
    },
  });
}

async function postingUnitsUsed(sessionId: string, profileId?: string | null) {
  const posts = await countPostsToday(sessionId, profileId);
  const media = profileId ? await countMediaToday(profileId) : 0;
  return posts + media;
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
  profileId?: string | null,
  extraUnits = 0
) {
  const s = await getScore({ sessionId, profileId });
  const bayes = Number(s?.bayesianMean ?? 0);
  const q = quotasForScore(bayes);

  const used = await postingUnitsUsed(sessionId, profileId);
  const needed = 1 + Math.max(0, extraUnits);
  if (used + needed > q.postsPerDay) {
    return { ok: false as const, error: 'Daily post limit reached' as const };
  }
  return { ok: true as const, quota: q };
}

export async function canUploadMedia(profileId: string, units = 1) {
  const s = await getScore({ profileId });
  const bayes = Number(s?.bayesianMean ?? 0);
  const q = quotasForScore(bayes);
  const usedPosts = await prisma.post.count({
    where: {
      profileId,
      createdAt: { gte: startOfUTCDay() },
    },
  });
  const usedMedia = await countMediaToday(profileId);
  if (usedPosts + usedMedia + units > q.postsPerDay) {
    return { ok: false as const, error: 'Daily post limit reached' as const };
  }
  return { ok: true as const, quota: q };
}

/**
 * Reply quota gate.
 * Signature matches older call sites: canCreateReply(sid, profileId?, postId?)
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

// New name so modern call sites can import it directly
export async function canReply(
  sessionId: string,
  profileId?: string | null,
  postId?: string
) {
  return canCreateReply(sessionId, profileId, postId);
}
