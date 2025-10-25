import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from '@/lib/zod';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import crypto from 'crypto';

const CreateInviteSchema = z.object({
  uses: z.number().int().min(1).max(100).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

async function loadSpaceBySlug(slug: string) {
  return prisma.space.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
}
async function roleFor(profileId: string | null, spaceId: string) {
  if (!profileId) return null;
  const rows = await prisma.$queryRaw<{ role: 'OWNER' | 'MODERATOR' | 'MEMBER' }[]>`
    SELECT role FROM "SpaceMembership" WHERE "spaceId"=${spaceId} AND "profileId"=${profileId} LIMIT 1`;
  return rows[0]?.role ?? null;
}

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const space = await loadSpaceBySlug(ctx.params.slug);
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const me = await getCurrentProfileId();
  const r = await roleFor(me, space.id);
  if (r !== 'OWNER' && r !== 'MODERATOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.$queryRaw<
    { id: string; token: string; usesRemaining: number; expiresAt: Date | null; createdAt: Date }[]
  >`SELECT id, token, "usesRemaining", "expiresAt", "createdAt" FROM "SpaceInvite" WHERE "spaceId"=${space.id} ORDER BY "createdAt" DESC LIMIT 100`;

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return NextResponse.json({
    invites: rows.map((x) => ({
      id: x.id,
      createdAt: x.createdAt,
      usesRemaining: x.usesRemaining,
      expiresAt: x.expiresAt,
      link: `${base}/space/invite/${x.token}`,
      tokenPreview: `${x.token.slice(0, 6)}…${x.token.slice(-6)}`,
    })),
  });
}

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  const input = CreateInviteSchema.parse(await requireJson(req));

  const space = await loadSpaceBySlug(ctx.params.slug);
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const me = await getCurrentProfileId();
  const r = await roleFor(me, space.id);
  if (r !== 'OWNER' && r !== 'MODERATOR') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('base64url');
  const uses = input.uses ?? 1;
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400_000) : null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "SpaceInvite" ("id","spaceId","token","usesRemaining","expiresAt","createdById")
     VALUES ($1,$2,$3,$4,$5,$6)`,
    id,
    space.id,
    token,
    uses,
    expiresAt,
    me,
  );

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return NextResponse.json({ ok: true, link: `${base}/space/invite/${token}` });
}
