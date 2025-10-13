import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { quotasForScore, recomputeScore, recomputeScoreForProfile } from '@/lib/reputation';

export async function GET(_req: Request, ctx: { params: Promise<{ handle: string }> }) {
  const { handle } = await ctx.params;               // ✅ Next 15
  const h = decodeURIComponent(handle).toLowerCase();

  // Prefer Profile score; fall back to legacy SessionProfile score
  const prof = await prisma.profile.findUnique({ where: { handle: h } });
  if (prof) {
    const score = (await prisma.reputationScore.findFirst({ where: { profileId: prof.id } }))
               ?? (await recomputeScoreForProfile(prof.id));
    const q = quotasForScore(score.bayesianMean || 0);
    return NextResponse.json({
      ok: true,
      profile: { handle: h },
      score: { count: score.count, mean: score.mean, bayesianMean: score.bayesianMean, tier: q.tier },
    });
  }

  const sp = await prisma.sessionProfile.findFirst({ where: { handle: h } });
  if (!sp) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const score = (await prisma.reputationScore.findUnique({ where: { sessionId: sp.sessionId } }))
             ?? (await recomputeScore(sp.sessionId));
  const q = quotasForScore(score.bayesianMean || 0);

  return NextResponse.json({
    ok: true,
    profile: { handle: h },
    score: { count: score.count, mean: score.mean, bayesianMean: score.bayesianMean, tier: q.tier },
  });
}
