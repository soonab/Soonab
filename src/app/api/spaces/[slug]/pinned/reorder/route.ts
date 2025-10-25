import { NextRequest, NextResponse } from 'next/server';

import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const OrderSchema = z.object({ order: z.array(z.string().min(1)) });

type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

type RoleRow = { role: SpaceRole };

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

export async function PATCH(req: NextRequest, ctx: { params: { slug: string } }) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  const { order } = OrderSchema.parse(await requireJson(req));

  if (order.length < 1 || order.length > 10) {
    return NextResponse.json({ error: 'Order length out of range' }, { status: 400 });
  }

  const me = await getCurrentProfileId();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({ where: { slug: ctx.params.slug }, select: { id: true } });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const role = await roleFor(me, space.id);
  if (role !== 'OWNER' && role !== 'MODERATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pins = await prisma.$queryRaw<PinRow[]>`
    SELECT "postId" FROM "SpacePinnedPost"
    WHERE "spaceId" = ${space.id}
  `;

  if (!pins.length) {
    return NextResponse.json({ error: 'No pinned posts' }, { status: 400 });
  }

  if (order.length !== pins.length) {
    return NextResponse.json({ error: 'Order mismatch' }, { status: 400 });
  }

  const orderSet = new Set(order);
  if (orderSet.size !== order.length) {
    return NextResponse.json({ error: 'Duplicate post ids' }, { status: 400 });
  }

  const pinnedSet = new Set(pins.map((row) => row.postId));
  for (const id of order) {
    if (!pinnedSet.has(id)) {
      return NextResponse.json({ error: 'Post not pinned' }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < order.length; i += 1) {
      await tx.$executeRaw`
        UPDATE "SpacePinnedPost"
        SET position = ${i}
        WHERE "spaceId" = ${space.id} AND "postId" = ${order[i]!}
      `;
    }
  });

  return NextResponse.json({ ok: true });
}
