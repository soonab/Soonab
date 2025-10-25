import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { getCurrentProfileId } from '@/lib/auth';
import { z } from '@/lib/zod';
import crypto from 'crypto';

const AcceptSchema = z.object({ token: z.string().min(20).max(200) });

export async function POST(req: NextRequest) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  const { token } = AcceptSchema.parse(await requireJson(req));

  const me = await getCurrentProfileId();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await prisma.$transaction(async (tx) => {
    const inv = (
      await tx.$queryRaw<
        { id: string; spaceId: string; usesRemaining: number; expiresAt: Date | null; createdById: string }[]
      >`SELECT id,"spaceId","usesRemaining","expiresAt","createdById" FROM "SpaceInvite" WHERE token=${token} LIMIT 1`
    )[0];

    if (!inv) return { ok: false as const, code: 404 as const };
    if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
      await tx.$executeRaw`DELETE FROM "SpaceInvite" WHERE id=${inv.id}`;
      return { ok: false as const, code: 410 as const };
    }
    if (inv.usesRemaining <= 0) {
      await tx.$executeRaw`DELETE FROM "SpaceInvite" WHERE id=${inv.id}`;
      return { ok: false as const, code: 410 as const };
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO "SpaceMembership" ("id","spaceId","profileId","role","invitedById","joinedViaInvite","createdAt")
       VALUES ($1,$2,$3,'MEMBER',$4,true,NOW())
       ON CONFLICT ("spaceId","profileId") DO UPDATE SET "invitedById"=EXCLUDED."invitedById","joinedViaInvite"=true`,
      crypto.randomUUID(),
      inv.spaceId,
      me,
      inv.createdById,
    );

    await tx.$executeRaw`UPDATE "SpaceInvite" SET "usesRemaining"="usesRemaining"-1 WHERE id=${inv.id}`;
    await tx.$executeRaw`DELETE FROM "SpaceInvite" WHERE id=${inv.id} AND "usesRemaining" <= 0`;

    const space = await tx.space.findUnique({ where: { id: inv.spaceId }, select: { slug: true } });
    return { ok: true as const, slug: space?.slug ?? '' };
  });

  if (!result.ok)
    return NextResponse.json({ error: result.code === 404 ? 'Invalid token' : 'Invite expired' }, { status: result.code });
  return NextResponse.json({ ok: true, spaceSlug: result.slug });
}
