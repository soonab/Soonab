import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  await assertSameOrigin(req);
  await requireCsrf(req);

  const me = await getCurrentProfileId();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({
    where: { slug: ctx.params.slug },
    select: { id: true, visibility: true },
  });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (space.visibility !== 'PUBLIC') {
    return NextResponse.json({ error: 'Invite required' }, { status: 403 });
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "SpaceMembership" ("id","spaceId","profileId","role","createdAt")
     VALUES ($1,$2,$3,'MEMBER',NOW())
     ON CONFLICT ("spaceId","profileId") DO NOTHING`,
    crypto.randomUUID(),
    space.id,
    me,
  );

  return NextResponse.json({ ok: true });
}
