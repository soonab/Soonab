import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthedUserId, getCurrentProfileId } from '@/lib/auth';

export async function GET() {
  const uid = await getAuthedUserId();
  const pid = await getCurrentProfileId();
  const user = uid ? await prisma.user.findUnique({ where: { id: uid } }) : null;
  const profile = pid ? await prisma.profile.findUnique({ where: { id: pid } }) : null;
  return NextResponse.json({ uid, pid, user, profile });
}
