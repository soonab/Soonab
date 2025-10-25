import { NextRequest, NextResponse } from 'next/server';

import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf } from '@/lib/security';

type SpaceOwner = {
  id: string;
  createdById: string;
};

type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

type MembershipRow = {
  role: SpaceRole;
  invitedById: string | null;
};

async function loadSpace(slug: string): Promise<SpaceOwner | null> {
  return prisma.space.findUnique({
    where: { slug },
    select: { id: true, createdById: true },
  });
}

async function getMembership(spaceId: string, profileId: string): Promise<MembershipRow | null> {
  const rows = await prisma.$queryRaw<MembershipRow[]>`
    SELECT role, "invitedById"
    FROM "SpaceMembership"
    WHERE "spaceId" = ${spaceId} AND "profileId" = ${profileId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function DELETE(req: NextRequest, ctx: { params: { slug: string; profileId: string } }) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const me = await getCurrentProfileId();
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const space = await loadSpace(ctx.params.slug);
  if (!space) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const myMembership = await getMembership(space.id, me);
  const myRole = myMembership?.role ?? null;
  const isOwner = myRole === 'OWNER';
  const isMod = myRole === 'MODERATOR';

  const targetId = ctx.params.profileId;
  const targetMembership = await getMembership(space.id, targetId);
  if (!targetMembership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 404 });
  }

  const targetIsOwner = targetId === space.createdById || targetMembership.role === 'OWNER';
  const isSelf = targetId === me;

  let allowed = false;
  if (isOwner && !targetIsOwner) allowed = true;
  if (isMod && targetMembership.role === 'MEMBER' && !isSelf) allowed = true;
  if (targetMembership.invitedById && targetMembership.invitedById === me && !targetIsOwner && !isSelf) {
    allowed = true;
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.$executeRaw`
    DELETE FROM "SpaceMembership"
    WHERE "spaceId" = ${space.id} AND "profileId" = ${targetId}
  `;

  return NextResponse.json({ ok: true });
}
