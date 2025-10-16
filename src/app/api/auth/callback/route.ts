// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { consumeMagicToken } from '@/lib/magic';
import { setAuthCookie } from '@/lib/auth';
import { ensureSessionProfile } from '@/lib/identity';

/** Move legacy, session-authored content onto the new profile */
async function upgradeSessionContentToProfile(sessionId: string, profileId: string) {
  await prisma.post.updateMany({
    where: { sessionId, profileId: null },
    data: { profileId },
  });
  await prisma.reply.updateMany({
    where: { sessionId, profileId: null },
    data: { profileId },
  });
  await prisma.reputationRating.updateMany({
    where: { raterSessionId: sessionId, raterProfileId: null },
    data: { raterProfileId: profileId },
  });
  await prisma.reputationRating.updateMany({
    where: { targetSessionId: sessionId, targetProfileId: null },
    data: { targetProfileId: profileId },
  });
}

/** Ensure there is a ReputationScore row linked to the profile */
async function linkScoreToProfile(sessionId: string, profileId: string) {
  // Try session-keyed row → link profileId if missing
  const bySession = await prisma.reputationScore.findUnique({ where: { sessionId } });
  if (bySession) {
    if (!bySession.profileId) {
      await prisma.reputationScore.update({ where: { sessionId }, data: { profileId } });
    }
    return;
  }
  // If the profile already has a row, nothing to do
  const byProfile = await prisma.reputationScore.findFirst({ where: { profileId } });
  if (byProfile) return;

  // Create a fresh, zeroed row
  await prisma.reputationScore.create({
    data: { sessionId, profileId, count: 0, sum: 0, mean: 0, bayesianMean: 0 },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  // 0) Validate magic-link token -> email
  const email = await consumeMagicToken(token);
  if (!email) {
    return NextResponse.json({ ok: false, error: 'invalid or expired token' }, { status: 400 });
  }

  // 1) Ensure we have an anonymous session cookie for continuity
  const jar = await cookies();
  let sid = jar.get('sid')?.value ?? '';
  if (!sid) {
    sid = randomUUID();
    jar.set('sid', sid, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }

  // 2) Ensure there’s a SessionProfile so we may claim its handle
  const sp = await ensureSessionProfile(sid);

  // 3) Upsert user by email
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // 4) Choose a handle: prefer the session handle unless it belongs to someone else
  let chosenHandle = sp.handle;
  const existingProfile = await prisma.profile.findUnique({ where: { handle: chosenHandle } });
  if (existingProfile && existingProfile.userId !== user.id) {
    // Collision: generate a simple unique fallback like "nab-xxxx"
    let ok = false;
    while (!ok) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const candidate = `nab-${suffix}`;
      const clash = await prisma.profile.findUnique({ where: { handle: candidate } });
      if (!clash) {
        chosenHandle = candidate;
        ok = true;
      }
    }
  }

  // 5) Create or connect profile for this user with the chosen handle
  const profile = await prisma.profile.upsert({
    where: { handle: chosenHandle },
    update: { userId: user.id },
    create: { userId: user.id, handle: chosenHandle },
  });

  // 6) Migrate legacy content & link score row
  await upgradeSessionContentToProfile(sid, profile.id);
  await linkScoreToProfile(sid, profile.id);

  // 7) NEW cookie model: set signed JWT auth cookie (no separate pid cookie)
  await setAuthCookie(user.id);

  // 8) Redirect to the profile page
  return NextResponse.redirect(new URL(`/s/${profile.handle}`, url.origin));
}
