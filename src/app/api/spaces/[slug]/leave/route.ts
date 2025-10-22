import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf } from '@/lib/security';

const db = prisma as any;

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const space = await db.space.findUnique({ where: { slug: params.slug } });
  if (!space) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await db.spaceMembership.deleteMany({ where: { spaceId: space.id, profileId } });

  return NextResponse.json({ ok: true });
}
