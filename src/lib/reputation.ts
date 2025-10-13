import { prisma } from '@/lib/db'

const PRIOR_MEAN   = Number(process.env.REP_PRIOR_MEAN ?? 4.0)
const PRIOR_WEIGHT = Number(process.env.REP_PRIOR_WEIGHT ?? 5)

const WEIGHT_MIN   = Number(process.env.REP_WEIGHT_MIN ?? 0.25)
const WEIGHT_MAX   = Number(process.env.REP_WEIGHT_MAX ?? 1.25)
const HALF_LIFE_D  = Number(process.env.REP_RATING_HALFLIFE_DAYS ?? 180)

export function quotasForScore(bm: number) {
  if (bm >= 4.5) return { postsPerDay: 4, repliesPerDay: 24, perThreadDaily: 12, tier: 'A+' }
  if (bm >= 4.0) return { postsPerDay: 3, repliesPerDay: 18, perThreadDaily: 9,  tier: 'A'  }
  if (bm >= 3.0) return { postsPerDay: 2, repliesPerDay: 12, perThreadDaily: 6,  tier: 'B'  }
  return             { postsPerDay: 1, repliesPerDay: 6,  perThreadDaily: 3,  tier: 'C'  }
}

function clamp1to5(x: number) { return Math.min(5, Math.max(1, x)) }

function weightFromRaterScore(raterBayes: number): number {
  const clamped = clamp1to5(raterBayes || PRIOR_MEAN)
  const t = (clamped - 1) / 4
  return WEIGHT_MIN + t * (WEIGHT_MAX - WEIGHT_MIN)
}

function recencyFactor(updatedAt: Date): number {
  if (HALF_LIFE_D <= 0) return 1
  const ageDays = (Date.now() - updatedAt.getTime()) / 86_400_000
  return Math.pow(0.5, ageDays / HALF_LIFE_D)
}

/** ---------- SESSION-BASED (legacy) ---------- */

/** Recompute cached score for a target *session* with weighting + decay */
export async function recomputeScore(targetSessionId: string) {
  const ratings = await prisma.reputationRating.findMany({
    where: { targetSessionId },
    orderBy: { updatedAt: 'desc' },
    select: { value: true, updatedAt: true, raterSessionId: true },
  })

  const rawCount = ratings.length
  const rawSum   = ratings.reduce((s, r) => s + r.value, 0)
  const rawMean  = rawCount ? rawSum / rawCount : 0

  const raterIds = Array.from(new Set(ratings.map(r => r.raterSessionId).filter(Boolean) as string[]))
  const raterScores = raterIds.length
    ? await prisma.reputationScore.findMany({
        where: { sessionId: { in: raterIds } },
        select: { sessionId: true, bayesianMean: true },
      })
    : []
  const scoreMap = new Map(raterScores.map(s => [s.sessionId, s.bayesianMean ?? PRIOR_MEAN]))

  let wSum = 0
  let wCnt = 0
  for (const r of ratings) {
    const raterBayes = scoreMap.get(r.raterSessionId!) ?? PRIOR_MEAN
    const w = weightFromRaterScore(raterBayes) * recencyFactor(r.updatedAt)
    wSum += r.value * w
    wCnt += w
  }

  const bayesianMean =
    (PRIOR_MEAN * PRIOR_WEIGHT + wSum) / (PRIOR_WEIGHT + (wCnt || 0.000001))

  const score = await prisma.reputationScore.upsert({
    where: { sessionId: targetSessionId },
    update: { count: rawCount, sum: rawSum, mean: rawMean, bayesianMean },
    create: { sessionId: targetSessionId, count: rawCount, sum: rawSum, mean: rawMean, bayesianMean },
  })

  return score
}

/** ---------- PROFILE-AWARE ---------- */

/** Recompute cached score for a target *profile* (when no sessionId is available). */
export async function recomputeScoreForProfile(targetProfileId: string) {
  const ratings = await prisma.reputationRating.findMany({
    where: { targetProfileId },
    orderBy: { updatedAt: 'desc' },
    select: { value: true, updatedAt: true, raterSessionId: true, raterProfileId: true },
  })

  const rawCount = ratings.length
  const rawSum   = ratings.reduce((s, r) => s + r.value, 0)
  const rawMean  = rawCount ? rawSum / rawCount : 0

  // rater weights — prefer profile-based ReputationScore, fallback to session-based
  const raterProfileIds = Array.from(new Set(ratings.map(r => r.raterProfileId).filter(Boolean) as string[]))
  const raterSessionIds = Array.from(new Set(ratings.map(r => r.raterSessionId).filter(Boolean) as string[]))

  const byProfile = raterProfileIds.length
    ? await prisma.reputationScore.findMany({
        where: { profileId: { in: raterProfileIds } },
        select: { profileId: true, bayesianMean: true },
      })
    : []

  const bySession = raterSessionIds.length
    ? await prisma.reputationScore.findMany({
        where: { sessionId: { in: raterSessionIds } },
        select: { sessionId: true, bayesianMean: true },
      })
    : []

  const pMap = new Map(byProfile.map(s => [s.profileId!, s.bayesianMean ?? PRIOR_MEAN]))
  const sMap = new Map(bySession.map(s => [s.sessionId,    s.bayesianMean ?? PRIOR_MEAN]))

  let wSum = 0, wCnt = 0
  for (const r of ratings) {
    const bayes =
      (r.raterProfileId && pMap.get(r.raterProfileId)) ??
      (r.raterSessionId && sMap.get(r.raterSessionId)) ??
      PRIOR_MEAN
    const w = weightFromRaterScore(bayes) * recencyFactor(r.updatedAt)
    wSum += r.value * w
    wCnt += w
  }

  const bayesianMean =
    (PRIOR_MEAN * PRIOR_WEIGHT + wSum) / (PRIOR_WEIGHT + (wCnt || 0.000001))

  // Persist in ReputationScore (unique on profileId). If a profile row exists, update it.
  const existingProfileRow = await prisma.reputationScore.findFirst({ where: { profileId: targetProfileId } })
  if (existingProfileRow) {
    return prisma.reputationScore.update({
      where: { sessionId: existingProfileRow.sessionId },
      data: { count: rawCount, sum: rawSum, mean: rawMean, bayesianMean },
    })
  }

  // Try to upgrade a session-row if one is discoverable via the profile's handle
  const prof = await prisma.profile.findUnique({ where: { id: targetProfileId }, select: { handle: true } })
  if (prof) {
    const sp = await prisma.sessionProfile.findFirst({ where: { handle: prof.handle } })
    if (sp) {
      const maybeRow = await prisma.reputationScore.findUnique({ where: { sessionId: sp.sessionId } })
      if (maybeRow) {
        return prisma.reputationScore.update({
          where: { sessionId: sp.sessionId },
          data: { profileId: targetProfileId, count: rawCount, sum: rawSum, mean: rawMean, bayesianMean },
        })
      }
    }
  }

  // Last resort: create a profile-linked row with a synthetic sessionId
  return prisma.reputationScore.create({
    data: {
      sessionId: `p:${targetProfileId}`,
      profileId: targetProfileId,
      count: rawCount,
      sum: rawSum,
      mean: rawMean,
      bayesianMean,
    },
  })
}

/**
 * Return cached score or recompute if missing.
 * Pass whichever identifiers you have.
 */
export async function getScore(opts: { sessionId?: string | null, profileId?: string | null }) {
  const { sessionId = null, profileId = null } = opts || {}
  if (!sessionId && !profileId) return null

  // Prefer profile score
  if (profileId) {
    const byProfile = await prisma.reputationScore.findUnique({ where: { profileId } })
    if (byProfile) return byProfile
  }
  if (sessionId) {
    const bySession = await prisma.reputationScore.findUnique({ where: { sessionId } })
    if (bySession) return bySession
  }

  // Recompute if missing
  if (profileId) return recomputeScoreForProfile(profileId)
  if (sessionId)  return recomputeScore(sessionId)
  return null
}

/** ---------- Suspicion flags (Step-4) ---------- */

export async function maybeFlagBrigade(targetSessionId: string) {
  const windowMin = Number(process.env.REP_BRIGADE_WINDOW_MIN ?? 60)
  const minRaters = Number(process.env.REP_BRIGADE_MIN_RATERS ?? 6)
  if (windowMin <= 0 || minRaters <= 0) return null

  const since = new Date(Date.now() - windowMin * 60_000)
  const recent = await prisma.reputationRating.findMany({
    where: { targetSessionId, updatedAt: { gte: since } },
    select: { raterSessionId: true },
  })
  const uniqueCount = new Set(recent.map(r => r.raterSessionId)).size

  if (uniqueCount >= minRaters) {
    return prisma.reputationFlag.create({
      data: {
        targetSessionId,
        windowStart: since,
        windowEnd: new Date(),
        reason: 'BRIGADE_SUSPECT',
        count: uniqueCount,
      },
    })
  }
  return null
}
