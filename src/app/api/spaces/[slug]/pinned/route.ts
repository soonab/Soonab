import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type PinnedPostRow = {
  postId: string;
  body: string;
  createdAt: Date;
  position: number;
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const space = await prisma.space.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rows = await prisma.$queryRaw<PinnedPostRow[]>`
    SELECT sp."postId", p.body, p."createdAt", sp.position
    FROM "SpacePinnedPost" sp
    JOIN "Post" p ON p.id = sp."postId"
    WHERE sp."spaceId" = ${space.id} AND p.state = 'ACTIVE'
    ORDER BY sp.position ASC, sp."createdAt" DESC
    LIMIT 8`;

  return NextResponse.json({ pinned: rows });
}
