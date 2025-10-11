import { prisma } from './db'

const PRIOR_MEAN = Number(process.env.REP_PRIOR_MEAN ?? 4.0)
const PRIOR_WEIGHT = Number(process.env.REP_PRIOR_WEIGHT ?? 5)

export function quotasForScore(bm: number) {
  if (bm >= 4.5) return { postsPerDay: 4, repliesPerDay: 24, perThreadDaily: 12, tier: 'A+' }
  if (bm >= 4.0) return { postsPerDay: 3, repliesPerDay: 18, perThreadDaily: 9,  tier: 'A'  }
  if (bm >= 3.0) return { postsPerDay: 2, repliesPerDay: 12, perThreadDaily: 6,  tier: 'B'  }
  return             { postsPerDay: 1, repliesPerDay: 6,  perThreadDaily: 3,  tier: 'C'  }
}

export async function recomputeScore(sessionId: string) {
  const agg = await prisma.reputationRating.groupBy({
    by: ['targetSessionId'],
    where: { targetSessionId: sessionId },
    _count: { _all: true },
    _sum: { value: true },
  })

  const count = agg[0]?._count._all ?? 0
  const sum = agg[0]?._sum.value ?? 0
  const mean = count > 0 ? sum / count : 0
  const bayesianMean = (PRIOR_MEAN * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + (count || 0) || 1)

  await prisma.reputationScore.upsert({
    where: { sessionId },
    update: { count, sum, mean, bayesianMean },
    create: { sessionId, count, sum, mean, bayesianMean },
  })

  return { count, sum, mean, bayesianMean }
}

export async function getScore(sessionId: string) {
  let s = await prisma.reputationScore.findUnique({ where: { sessionId } })
  if (!s) s = await recomputeScore(sessionId)
  return s
}
