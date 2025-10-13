// src/lib/reputation.ts
import { prisma } from '@/lib/db';

const PRIOR_MEAN   = Number(process.env.REP_PRIOR_MEAN ?? 4.0);
const PRIOR_WEIGHT = Number(process.env.REP_PRIOR_WEIGHT ?? 5);

const WEIGHT_MIN   = Number(process.env.REP_WEIGHT_MIN ?? 0.25);  // min weight for a 1★ rater
const WEIGHT_MAX   = Number(process.env.REP_WEIGHT_MAX ?? 1.25);  // max weight for a 5★ rater
const HALF_LIFE_D  = Number(process.env.REP_RATING_HALFLIFE_DAYS ?? 180);

/** Quotas derived from bayesianMean (kept from Step‑3) */
export function quotasForScore(bm: number) {
  if (bm >= 4.5) return { postsPerDay: 4, repliesPerDay: 24, perThreadDaily: 12, tier: 'A+' };
  if (bm >= 4.0) return { postsPerDay: 3, repliesPerDay: 18, perThreadDaily: 9,  tier: 'A'  };
  if (bm >= 3.0) return { postsPerDay: 2, repliesPerDay: 12, perThreadDaily: 6,  tier: 'B'  };
  return             { postsPerDay: 1, repliesPerDay: 6,  perThreadDaily: 3,  tier: 'C'  };
}

// Map rater's bayesianMean (1..5) -> linear weight [WEIGHT_MIN..WEIGHT_MAX]
function weightFromRaterScore(raterBayes: number): number {
  const clamped = Math.min(5, Math.max(1, raterBayes || PRIOR_MEAN));
  const t = (clamped - 1) / 4; // 0..1
  return WEIGHT_MIN + t * (WEIGHT_MAX - WEIGHT_MIN);
}

// Exponential recency decay
function recencyFactor(updatedAt: Date): number {
  if (HALF_LIFE_D <= 0) return 1;
  const ageDays = (Date.now() - updatedAt.getTime()) / 86400000;
  return Math.pow(0.5, ageDays / HALF_LIFE_D);
}

/** Recompute cached score for a target session with weighting + decay */
export async function recomputeScore(targetSessionId: string) {
  const ratings = await prisma.reputationRating.findMany({
    where: { targetSessionId },
    orderBy: { updatedAt: 'desc' },
    select: { value: true, updatedAt: true, raterSessionId: true },
  });

  const rawCount = ratings.length;
  const rawSum   = ratings.reduce((s, r) => s + r.value, 0);
  const rawMean  = rawCount ? rawSum / rawCount : 0;

  // Get rater bayesianMeans
  const raterIds = Array.from(new Set(ratings.map(r => r.raterSessionId)));
  const raterScores = raterIds.length
    ? await prisma.reputationScore.findMany({
        where: { sessionId: { in: raterIds } },
        select: { sessionId: true, bayesianMean: true },
      })
    : [];
  const scoreMap = new Map(raterScores.map(s => [s.sessionId, s.bayesianMean ?? PRIOR_MEAN]));

  // Weighted sums
  let wSum = 0;
  let wCnt = 0;
  for (const r of ratings) {
    const raterBayes = scoreMap.get(r.raterSessionId) ?? PRIOR_MEAN;
    const w = weightFromRaterScore(raterBayes) * recencyFactor(r.updatedAt);
    wSum += r.value * w;
    wCnt += w;
  }

  const bayesianMean =
    (PRIOR_MEAN * PRIOR_WEIGHT + wSum) / (PRIOR_WEIGHT + (wCnt || 0.000001));

  const score = await prisma.reputationScore.upsert({
    where: { sessionId: targetSessionId },
    update: { count: rawCount, sum: rawSum, mean: rawMean, bayesianMean },
    create: { sessionId: targetSessionId, count: rawCount, sum: rawSum, mean: rawMean, bayesianMean },
  });

  return score;
}

/** Return cached score or recompute if missing */
export async function getScore(sessionId: string) {
  const s = await prisma.reputationScore.findUnique({ where: { sessionId } });
  if (s) return s;
  return recomputeScore(sessionId);
}

/** Flag if many unique raters hit a target in a short window */
export async function maybeFlagBrigade(targetSessionId: string) {
  const windowMin = Number(process.env.REP_BRIGADE_WINDOW_MIN ?? 60);
  const minRaters = Number(process.env.REP_BRIGADE_MIN_RATERS ?? 6);
  if (windowMin <= 0 || minRaters <= 0) return null;

  const since = new Date(Date.now() - windowMin * 60_000);
  const recent = await prisma.reputationRating.findMany({
    where: { targetSessionId, updatedAt: { gte: since } },
    select: { raterSessionId: true },
  });
  const uniqueCount = new Set(recent.map(r => r.raterSessionId)).size;

  if (uniqueCount >= minRaters) {
    return prisma.reputationFlag.create({
      data: {
        targetSessionId,
        windowStart: since,
        windowEnd: new Date(),
        reason: 'BRIGADE_SUSPECT',
        count: uniqueCount,
      },
    });
  }
  return null;
}
