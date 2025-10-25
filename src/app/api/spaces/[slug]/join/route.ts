import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf } from '@/lib/security';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const profileId = await getCurrentProfileId();
  if (!profileId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { slug }, select: { id: true } });
  if (!space) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.spaceMembership.upsert({
    where: { spaceId_profileId: { spaceId: space.id, profileId } },
    update: {},
    create: { spaceId: space.id, profileId, role: 'MEMBER' },
  });

  return NextResponse.json({ ok: true });
}
