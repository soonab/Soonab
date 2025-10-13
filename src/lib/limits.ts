import { prisma } from '@/lib/db';
import { getScore, quotasForScore } from '@/lib/reputation';

const PRIOR_MEAN = Number(process.env.REP_PRIOR_MEAN ?? 4.0);

function utcDayRange(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

function idOr(sessionId?: string | null, profileId?: string | null) {
  const or: any[] = [];
  if (profileId) or.push({ profileId });
  if (sessionId) or.push({ sessionId });
  // If neither is present, we return a filter that matches nothing
  return or.length > 0 ? { OR: or } : { id: '__no_match__' };
}

async function countPostsToday(sessionId?: string | null, profileId?: string | null) {
  const { start, end } = utcDayRange();
  return prisma.post.count({
    where: { createdAt: { gte: start, lt: end }, ...idOr(sessionId, profileId) },
  });
}

async function countRepliesToday(sessionId?: string | null, profileId?: string | null) {
  const { start, end } = utcDayRange();
  return prisma.reply.count({
    where: { createdAt: { gte: start, lt: end }, ...idOr(sessionId, profileId) },
  });
}

async function countRepliesOnPostToday(postId: string, sessionId?: string | null, profileId?: string | null) {
  const { start, end } = utcDayRange();
  return prisma.reply.count({
    where: { postId, createdAt: { gte: start, lt: end }, ...idOr(sessionId, profileId) },
  });
}

/** Gate for composing a post (uses session/profile identity and public quotas). */
export async function canCreatePost(sessionId: string | null | undefined, profileId?: string | null) {
  const s = await getScore(sessionId);
  const bm = s?.bayesianMean ?? PRIOR_MEAN;
  const q = quotasForScore(bm);

  const used = await countPostsToday(sessionId, profileId);
  if (used >= q.postsPerDay) return { ok: false as const, error: 'Daily post limit reached' as const };

  return { ok: true as const, quota: q };
}

/** Gate for composing a reply (global daily + per-thread caps). */
export async function canCreateReply(sessionId: string | null | undefined, profileId: string | null | undefined, postId: string) {
  const s = await getScore(sessionId);
  const bm = s?.bayesianMean ?? PRIOR_MEAN;
  const q = quotasForScore(bm);

  const used = await countRepliesToday(sessionId, profileId);
  if (used >= q.repliesPerDay) return { ok: false as const, error: 'Daily reply limit reached' as const };

  const threadUsed = await countRepliesOnPostToday(postId, sessionId, profileId);
  if (threadUsed >= q.perThreadDaily) return { ok: false as const, error: 'Thread reply limit reached' as const };

  return { ok: true as const, quota: q };
}
