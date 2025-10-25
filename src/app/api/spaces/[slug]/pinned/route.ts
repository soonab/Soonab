import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

// ─────────────────────────────────────────────────────────────────────────────
// Types
type PinnedPostRow = {
  postId: string;
  body: string;
  createdAt: Date;
  position: number;
};
type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';
type RoleRow = { role: SpaceRole };
type CountRow = { count: number };
type MaxRow = { max: number };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
const PinSchema = z.object({ postId: z.string().min(1) });

async function roleFor(profileId: string | null, spaceId: string): Promise<SpaceRole | null> {
  if (!profileId) return null;
  const rows = await prisma.$queryRaw<RoleRow[]>`
    SELECT role
    FROM "SpaceMembership"
    WHERE "spaceId"=${spaceId} AND "profileId"=${profileId}
    LIMIT 1
  `;
  return rows[0]?.role ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET: list pinned posts for a Space
export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const { slug } = ctx.params;

  const space = await prisma.space.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If your Post table has a "state" column, you can add:
  //   AND p.state = 'ACTIVE'
  const rows = await prisma.$queryRaw<PinnedPostRow[]>`
    SELECT sp."postId", p.body, p."createdAt", sp.position
    FROM "SpacePinnedPost" sp
    JOIN "Post" p ON p.id = sp."postId"
    WHERE sp."spaceId"=${space.id}
    ORDER BY sp.position ASC, sp."createdAt" DESC
    LIMIT 8
  `;

  return NextResponse.json({ pinned: rows });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST: pin a post in the Space (owner/mod only)
export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  const { postId } = PinSchema.parse(await requireJson(req));

  const me = await getCurrentProfileId();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const space = await prisma.space.findUnique({
    where: { slug: ctx.params.slug },
    select: { id: true },
  });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const myRole = await roleFor(me, space.id);
  if (myRole !== 'OWNER' && myRole !== 'MODERATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Ensure the post belongs to this Space
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { spaceId: true },
  });
  if (!post || post.spaceId !== space.id) {
    return NextResponse.json({ error: 'Post not in this Space' }, { status: 400 });
  }

  // No-op if already pinned
  const already = await prisma.$queryRaw<{ postId: string }[]>`
    SELECT "postId"
    FROM "SpacePinnedPost"
    WHERE "spaceId"=${space.id} AND "postId"=${postId}
    LIMIT 1
  `;
  if (already.length) return NextResponse.json({ ok: true });

  // Limit to 4 pinned posts (tweakable)
  const counts = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::int AS count
    FROM "SpacePinnedPost"
    WHERE "spaceId"=${space.id}
  `;
  if ((counts[0]?.count ?? 0) >= 4) {
    return NextResponse.json({ error: 'Max pinned posts reached' }, { status: 400 });
  }

  // Next position
  const maxRows = await prisma.$queryRaw<MaxRow[]>`
    SELECT COALESCE(MAX(position), -1) AS max
    FROM "SpacePinnedPost"
    WHERE "spaceId"=${space.id}
  `;
  const nextPos = (maxRows[0]?.max ?? -1) + 1;

  await prisma.$executeRaw`
    INSERT INTO "SpacePinnedPost" ("spaceId","postId","pinnedById","position","createdAt")
    VALUES (${space.id}, ${postId}, ${me}, ${nextPos}, NOW())
    ON CONFLICT ("spaceId","postId") DO NOTHING
  `;

  return NextResponse.json({ ok: true });
}
