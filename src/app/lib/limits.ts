import { prisma } from './db';
import { getScore, quotasForScore } from './reputation';

function startOfUtcDay() { const d = new Date(); d.setUTCHours(0,0,0,0); return d; }

export async function countPostsToday(sessionId: string) {
  return prisma.post.count({ where: { sessionId, createdAt: { gte: startOfUtcDay() } } });
}
export async function countRepliesToday(sessionId: string) {
  return prisma.reply.count({ where: { sessionId, createdAt: { gte: startOfUtcDay() } } });
}
export async function countRepliesTodayForThread(sessionId: string, postId: string) {
  return prisma.reply.count({ where: { sessionId, postId, createdAt: { gte: startOfUtcDay() } } });
}

export async function canCreatePost(sessionId: string) {
  const s = await getScore(sessionId);
  const q = quotasForScore(s.bayesianMean || 0);
  const used = await countPostsToday(sessionId);
  if (used >= q.postsPerDay) return { ok: false, error: 'Daily post limit reached' };
  return { ok: true, quota: q };
}

export async function canCreateReply(sessionId: string, postId: string) {
  const s = await getScore(sessionId);
  const q = quotasForScore(s.bayesianMean || 0);
  const [usedDay, usedThread] = await Promise.all([
    countRepliesToday(sessionId),
    countRepliesTodayForThread(sessionId, postId),
  ]);
  if (usedDay >= q.repliesPerDay) return { ok: false, error: 'Daily reply limit reached' };
  if (usedThread >= q.perThreadDaily) return { ok: false, error: 'Thread reply limit reached' };
  return { ok: true, quota: q };
}
