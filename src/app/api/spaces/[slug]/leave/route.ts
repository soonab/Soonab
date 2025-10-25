import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  await assertSameOrigin(req);
  await requireCsrf(req);

  const me = await getCurrentProfileId();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { slug: ctx.params.slug }, select: { id: true } });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$executeRaw`
    DELETE FROM "SpaceMembership"
    WHERE "spaceId" = ${space.id} AND "profileId" = ${me}
  `;

  return NextResponse.json({ ok: true });
}
