import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { ensureSessionProfile, getProfileByHandle } from '@/lib/identity';
import { recomputeScore, maybeFlagBrigade } from '@/lib/reputation';

const REQUIRE_INTERACTION_DAYS = Number(process.env.REP_REQUIRE_INTERACTION_DAYS ?? 7);
const PAIR_CD_HOURS = Number(process.env.REP_RATING_PAIR_COOLDOWN_HOURS ?? 24);
const GLOBAL_PER_HR = Number(process.env.REP_RATING_GLOBAL_PER_HOUR ?? 8);

async function interacted(raterSid: string, targetSid: string) {
  const since = new Date(Date.now() - REQUIRE_INTERACTION_DAYS * 86400000);
  const count = await prisma.reply.count({
    where: { sessionId: raterSid, createdAt: { gte: since }, post: { sessionId: targetSid } },
  });
  return count > 0;
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  let sid = jar.get('sid')?.value;
  if (!sid) sid = randomUUID();

  const { targetHandle, value } = await req.json();
  const val = Number(value);
  if (!targetHandle || !(val >= 1 && val <= 5))
    return NextResponse.json({ ok: false, error: 'targetHandle and value(1..5) required' }, { status: 400 });

  const target = await getProfileByHandle(targetHandle);
  if (!target) return NextResponse.json({ ok: false, error: 'Target not found' }, { status: 404 });
  if (target.sessionId === sid)
    return NextResponse.json({ ok: false, error: 'You cannot rate yourself' }, { status: 400 });

  // Identity and optional interaction gate
  await ensureSessionProfile(sid);
  if (REQUIRE_INTERACTION_DAYS > 0) {
    const ok = await interacted(sid, target.sessionId);
    if (!ok) return NextResponse.json({ ok: false, error: 'Interact (reply) before rating' }, { status: 403 });
  }

  // Pair cooldown: 1/day for rater->target
  if (PAIR_CD_HOURS > 0) {
    const since = new Date(Date.now() - PAIR_CD_HOURS * 3600_000);
    const recentPair = await prisma.reputationRating.findFirst({
      where: {
        raterSessionId: sid,
        targetSessionId: target.sessionId,
        updatedAt: { gte: since },
      },
      select: { updatedAt: true },
    });
    if (recentPair) {
      return NextResponse.json({ ok: false, error: 'You can update this rating once per day' }, { status: 429 });
    }
  }

  // Global cooldown: N/hour across all targets
  if (GLOBAL_PER_HR > 0) {
    const since = new Date(Date.now() - 3600_000);
    const updated = await prisma.reputationRating.count({
      where: { raterSessionId: sid, updatedAt: { gte: since } },
    });
    if (updated >= GLOBAL_PER_HR) {
      return NextResponse.json({ ok: false, error: 'Rating cooldown active' }, { status: 429 });
    }
  }

  // Upsert rating
  await prisma.reputationRating.upsert({
    where: { one_rater_per_target: { targetSessionId: target.sessionId, raterSessionId: sid } },
    update: { value: val },
    create: { targetSessionId: target.sessionId, raterSessionId: sid, value: val },
  });

  // Recompute and maybe flag
  const score = await recomputeScore(target.sessionId);
  await maybeFlagBrigade(target.sessionId);

  const res = NextResponse.json({ ok: true, score });
  res.cookies.set('sid', sid, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
