import { NextRequest, NextResponse } from 'next/server';

import { getCurrentProfileId } from '@/lib/auth';
import { prisma } from '@/lib/db';

type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';
type SpaceVisibility = 'PUBLIC' | 'INVITE';

type MembershipRow = { role: SpaceRole };

type MembershipResponse = {
  isMember: boolean;
  role: SpaceRole | null;
  visibility: SpaceVisibility;
  spaceId: string;
};

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const me = await getCurrentProfileId();

  const space = await prisma.space.findUnique({
    where: { slug: ctx.params.slug },
    select: { id: true, visibility: true },
  });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let membership: MembershipRow | undefined;
  if (me) {
    const rows = await prisma.$queryRaw<MembershipRow[]>`
      SELECT role FROM "SpaceMembership"
      WHERE "spaceId" = ${space.id} AND "profileId" = ${me}
      LIMIT 1
    `;
    membership = rows[0];
  }

  const body: MembershipResponse = {
    isMember: Boolean(membership),
    role: membership?.role ?? null,
    visibility: space.visibility,
    spaceId: space.id,
  };

  return NextResponse.json(body);
}
