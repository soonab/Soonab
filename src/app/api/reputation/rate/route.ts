// src/app/api/reputation/rate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { ensureSessionProfile } from '@/lib/identity';
import { getCurrentProfileId } from '@/lib/auth';
import { recomputeScore, recomputeScoreForProfile } from '@/lib/reputation';
import { assertSameOrigin, requireJson } from '@/lib/security';

const REQUIRE_INTERACTION_DAYS = Number(process.env.REP_REQUIRE_INTERACTION_DAYS ?? 7);

function daysAgo(d: number) {
  return new Date(Date.now() - d * 86_400_000);
}

export async function POST(req: NextRequest) {
  // ---- Security posture ----
  assertSameOrigin(req); // block cross-origin browser posts
  const body = await requireJson<{ targetHandle: string; value: number }>(req); // 415/400 correctly

  // ---- Identify rater (session + profile) ----
  const jar = await cookies();
  let sid = jar.get('sid')?.value;
  let setSid = false;
  if (!sid) { sid = randomUUID(); setSid = true; }
  const pid = await getCurrentProfileId(); // may be null (signed-out)

  // ---- Parse & validate payload ----
  const targetHandle = String(body?.targetHandle || '').trim().toLowerCase();
  const val = Number(body?.value);

  if (!targetHandle || !(val >= 1 && val <= 5)) {
    return NextResponse.json(
      { ok: false, error: 'targetHandle and value(1..5) required' },
      { status: 400 }
    );
  }

  // ---- Resolve target by handle (Profile preferred, Session fallback) ----
  const [targetProfile, targetSession] = await Promise.all([
    prisma.profile.findUnique({ where: { handle: targetHandle } }),
    prisma.sessionProfile.findFirst({ where: { handle: targetHandle } }),
  ]);

  if (!targetProfile && !targetSession) {
    return NextResponse.json({ ok: false, error: 'Target not found' }, { status: 404 });
  }

  const targetProfileId = targetProfile?.id ?? null;
  const targetSessionId = targetSession?.sessionId ?? null;

  // ---- No self-rating (handle both identity types) ----
  if ((pid && targetProfileId && pid === targetProfileId) ||
      (sid && targetSessionId && sid === targetSessionId)) {
    return NextResponse.json({ ok: false, error: 'You cannot rate yourself' }, { status: 400 });
  }

  // ---- Ensure rater has a SessionProfile (legacy continuity) ----
  await ensureSessionProfile(sid);

  // ---- Interaction gate (optional; enforce replies within N days) ----
  if (REQUIRE_INTERACTION_DAYS > 0) {
    const since = daysAgo(REQUIRE_INTERACTION_DAYS);
    const orClauses: any[] = [];
    if (pid && targetProfileId) orClauses.push({ profileId: pid, post: { profileId: targetProfileId } });
    if (pid && targetSessionId) orClauses.push({ profileId: pid, post: { sessionId: targetSessionId } });
    if (sid && targetProfileId) orClauses.push({ sessionId: sid, post: { profileId: targetProfileId } });
    if (sid && targetSessionId) orClauses.push({ sessionId: sid, post: { sessionId: targetSessionId } });

    const count = orClauses.length
      ? await prisma.reply.count({ where: { createdAt: { gte: since }, OR: orClauses } })
      : 0;

    if (count === 0) {
      return NextResponse.json({ ok: false, error: 'Interact (reply) before rating' }, { status: 403 });
    }
  }

  // ---- Upsert rating row (preserve whichever identifiers we have) ----
  const existing = await prisma.reputationRating.findFirst({
    where: {
      OR: [
        pid && targetProfileId ? { raterProfileId: pid, targetProfileId } : undefined,
        sid && targetSessionId ? { raterSessionId: sid, targetSessionId } : undefined,
      ].filter(Boolean) as any[],
    },
  });

  let rating;
  if (existing) {
    rating = await prisma.reputationRating.update({
      where: { id: existing.id },
      data: {
        value: val,
        // Merge: attach any now-known identifiers to unify legacy/new identities
        raterProfileId: pid ?? existing.raterProfileId,
        targetProfileId: targetProfileId ?? existing.targetProfileId,
        raterSessionId: sid ?? existing.raterSessionId,
        targetSessionId: targetSessionId ?? existing.targetSessionId,
      },
    });
  } else {
    rating = await prisma.reputationRating.create({
      data: {
        value: val,
        raterProfileId: pid ?? null,
        targetProfileId: targetProfileId ?? null,
        raterSessionId: sid ?? null,
        targetSessionId: targetSessionId ?? null,
      },
    });
  }

  // ---- Recompute target score (session-based preferred; else profile-based) ----
  let score = null;
  if (targetSessionId) {
    score = await recomputeScore(targetSessionId);
    // Best-effort: link score row to profileId if we have it
    if (targetProfileId && score && !score.profileId) {
      try {
        await prisma.reputationScore.update({
          where: { sessionId: targetSessionId },
          data: { profileId: targetProfileId },
        });
      } catch {/* ignore constraint races */}
    }
  } else if (targetProfileId) {
    score = await recomputeScoreForProfile(targetProfileId);
  }

  // ---- Response & cookie ----
  const res = NextResponse.json({ ok: true, ratingId: rating.id, score });
  if (setSid) {
    res.cookies.set('sid', sid, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
