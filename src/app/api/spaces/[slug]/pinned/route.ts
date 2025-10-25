import { NextRequest, NextResponse } from 'next/server';

import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const PinSchema = z.object({ postId: z.string().min(1) });

type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

type RoleRow = { role: SpaceRole };

type CountRow = { count: number };

type MaxRow = { max: number };

type PinRow = { postId: string };

async function roleFor(profileId: string | null, spaceId: string): Promise<SpaceRole | null> {
  if (!profileId) return null;

  const rows = await prisma.$queryRaw<RoleRow[]>`
    SELECT role FROM "SpaceMembership"
    WHERE "spaceId" = ${spaceId} AND "profileId" = ${profileId}
    LIMIT 1
  `;

  return rows[0]?.role ?? null;
}

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  const { postId } = PinSchema.parse(await requireJson(req));

  const me = await getCurrentProfileId();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { slug: ctx.params.slug }, select: { id: true } });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const role = await roleFor(me, space.id);
  if (role !== 'OWNER' && role !== 'MODERATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { spaceId: true } });
  if (!post || post.spaceId !== space.id) {
    return NextResponse.json({ error: 'Post not in this Space' }, { status: 400 });
  }

  const alreadyPinned = await prisma.$queryRaw<PinRow[]>`
    SELECT "postId" FROM "SpacePinnedPost"
    WHERE "spaceId" = ${space.id} AND "postId" = ${postId}
    LIMIT 1
  `;
  if (alreadyPinned[0]) {
    return NextResponse.json({ ok: true });
  }

  const countRow = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS count FROM "SpacePinnedPost"
    WHERE "spaceId" = ${space.id}
  `;
  const count = countRow[0]?.count ?? 0;
  if (count >= 4) {
    return NextResponse.json({ error: 'Max pinned posts reached' }, { status: 400 });
  }

  const maxRow = await prisma.$queryRaw<MaxRow[]>`
    SELECT COALESCE(MAX(position), -1) AS max FROM "SpacePinnedPost"
    WHERE "spaceId" = ${space.id}
  `;
  const position = (maxRow[0]?.max ?? -1) + 1;

  await prisma.$executeRaw`
    INSERT INTO "SpacePinnedPost" ("spaceId","postId","pinnedById","position","createdAt")
    VALUES (${space.id}, ${postId}, ${me}, ${position}, NOW())
    ON CONFLICT ("spaceId","postId") DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}
