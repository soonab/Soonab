import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { consumeMagicToken, setAuthCookies } from '@/lib/auth';
import { ensureSessionProfile } from '@/lib/identity';

async function upgradeSessionContentToProfile(sessionId: string, profileId: string) {
  await prisma.post.updateMany({ where: { sessionId, profileId: null }, data: { profileId } });
  await prisma.reply.updateMany({ where: { sessionId, profileId: null }, data: { profileId } });
  await prisma.reputationRating.updateMany({ where: { raterSessionId: sessionId, raterProfileId: null }, data: { raterProfileId: profileId } });
  await prisma.reputationRating.updateMany({ where: { targetSessionId: sessionId, targetProfileId: null }, data: { targetProfileId: profileId } });
}

/** Attach or create a ReputationScore row and link it to the profile */
async function linkScoreToProfile(sessionId: string, profileId: string) {
  // 1) Try session row → link profileId
  const bySession = await prisma.reputationScore.findUnique({ where: { sessionId } });
  if (bySession) {
    if (!bySession.profileId) {
      await prisma.reputationScore.update({ where: { sessionId }, data: { profileId } });
    }
    return;
  }
  // 2) If a row already exists for this profile, nothing to do
  const byProfile = await prisma.reputationScore.findFirst({ where: { profileId } });
  if (byProfile) return;

  // 3) Create a fresh row (zeroed)
  await prisma.reputationScore.create({
    data: { sessionId, profileId, count: 0, sum: 0, mean: 0, bayesianMean: 0 },
  });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const email = await consumeMagicToken(token);
  if (!email) return NextResponse.json({ ok: false, error: 'invalid or expired token' }, { status: 400 });

  // Ensure we have a session id and cookie
  const jar = await cookies();
  let sid = jar.get('sid')?.value ?? '';
  if (!sid) {
    sid = randomUUID();
    // keep the same cookie shape used elsewhere
    jar.set('sid', sid, {
      httpOnly: true, sameSite: 'lax', path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Ensure there's a session profile so we can optionally "claim" its handle
  const sp = await ensureSessionProfile(sid);

  // 1) upsert user by email
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // 2) pick a handle: prefer session handle if not used by someone else
  let chosenHandle = sp.handle;
  const existingProfile = await prisma.profile.findUnique({ where: { handle: chosenHandle } });
  if (existingProfile && existingProfile.userId !== user.id) {
    // Session handle collides with another user; generate a new one
    let ok = false;
    while (!ok) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const candidate = `nab-${suffix}`;
      const clash = await prisma.profile.findUnique({ where: { handle: candidate } });
      if (!clash) { chosenHandle = candidate; ok = true; }
    }
  }

  // 3) create or connect profile for this user with the chosen handle
  const profile = await prisma.profile.upsert({
    where: { handle: chosenHandle },
    update: { userId: user.id },
    create: { userId: user.id, handle: chosenHandle },
  });

  // 4) upgrade legacy content
  await upgradeSessionContentToProfile(sid, profile.id);

  // 5) ensure the reputation score row is mapped to this profile
  await linkScoreToProfile(sid, profile.id);

  // 6) set auth cookies and redirect to my profile
  await setAuthCookies(user.id, profile.id);
  return NextResponse.redirect(new URL(`/s/${profile.handle}`, url.origin));
}
