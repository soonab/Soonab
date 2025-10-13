import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserId, getCurrentProfileId } from '@/lib/auth';

export async function GET() {
  const uid = await getCurrentUserId();
  const pid = await getCurrentProfileId();
  if (!uid || !pid) return NextResponse.json({ ok: false, error: 'not signed in' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: uid } });
  const profile = await prisma.profile.findUnique({ where: { id: pid } });

  const posts = await prisma.post.findMany({ where: { profileId: pid }, orderBy: { createdAt: 'desc' } });
  const replies = await prisma.reply.findMany({ where: { profileId: pid }, orderBy: { createdAt: 'desc' } });
  const ratingsGiven = await prisma.reputationRating.findMany({ where: { raterProfileId: pid } });
  const ratingsReceived = await prisma.reputationRating.findMany({ where: { targetProfileId: pid } });

  return NextResponse.json({ ok: true, export: { user, profile, posts, replies, ratingsGiven, ratingsReceived } });
}
