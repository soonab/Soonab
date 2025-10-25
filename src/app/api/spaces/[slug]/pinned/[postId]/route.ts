import { NextRequest, NextResponse } from 'next/server';

import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf } from '@/lib/security';

type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

type RoleRow = { role: SpaceRole };

export async function DELETE(req: NextRequest, ctx: { params: { slug: string; postId: string } }) {
  await assertSameOrigin(req);
  await requireCsrf(req);

  const me = await getCurrentProfileId();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { slug: ctx.params.slug }, select: { id: true } });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = await prisma.$queryRaw<RoleRow[]>`
    SELECT role FROM "SpaceMembership"
    WHERE "spaceId" = ${space.id} AND "profileId" = ${me}
    LIMIT 1
  `;
  const role = rows[0]?.role ?? null;
  if (role !== 'OWNER' && role !== 'MODERATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.$executeRaw`
    DELETE FROM "SpacePinnedPost"
    WHERE "spaceId" = ${space.id} AND "postId" = ${ctx.params.postId}
  `;
  return NextResponse.json({ ok: true });
}
