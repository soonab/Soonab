import { NextRequest, NextResponse } from 'next/server';

import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';

type SpaceSummary = {
  id: string;
  slug: string;
  name: string;
  createdById: string;
};

type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

type MemberRow = {
  profileId: string;
  handle: string;
  name: string | null;
  role: SpaceRole;
  invitedById: string | null;
};

type MemberSummary = {
  id: string;
  handle: string;
  name: string | null;
  role: SpaceRole;
  isSelf: boolean;
  canRemove: boolean;
  invitedByYou: boolean;
};

async function loadSpace(slug: string): Promise<SpaceSummary | null> {
  return prisma.space.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, createdById: true },
  });
}

async function roleFor(profileId: string | null, spaceId: string): Promise<SpaceRole | null> {
  if (!profileId) return null;

  const rows = await prisma.$queryRaw<{ role: SpaceRole }[]>`
    SELECT role FROM "SpaceMembership"
    WHERE "spaceId" = ${spaceId} AND "profileId" = ${profileId}
    LIMIT 1
  `;

  return rows[0]?.role ?? null;
}

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const space = await loadSpace(ctx.params.slug);
  if (!space) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const me = await getCurrentProfileId();
  const myRole = await roleFor(me, space.id);
  const isOwner = myRole === 'OWNER';
  const isMod = myRole === 'MODERATOR';

  if (!isOwner && !isMod) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<MemberRow[]>`
    SELECT m."profileId", p.handle, p.name, m.role, m."invitedById"
    FROM "SpaceMembership" m
    JOIN "Profile" p ON p.id = m."profileId"
    WHERE m."spaceId" = ${space.id}
    ORDER BY m."createdAt" ASC
  `;

  const members: MemberSummary[] = rows.map((row) => {
    const isSelf = row.profileId === me;
    const targetIsOwner = row.profileId === space.createdById || row.role === 'OWNER';
    let canRemove = false;

    if (isOwner && !targetIsOwner) canRemove = true;
    if (isMod && row.role === 'MEMBER' && !isSelf) canRemove = true;
    if (row.invitedById && row.invitedById === me && !targetIsOwner && !isSelf) {
      canRemove = true;
    }

    return {
      id: row.profileId,
      handle: row.handle,
      name: row.name,
      role: row.role,
      isSelf,
      canRemove,
      invitedByYou: row.invitedById === me,
    } satisfies MemberSummary;
  });

  return NextResponse.json({ members });
}
