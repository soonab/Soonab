// src/app/api/spaces/[slug]/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function decodeCursor(raw: string | null) {
  if (!raw) return null;
  const [ts, id] = raw.split('_');
  if (!ts || !id) return null;
  const ms = Number(ts);
  if (!Number.isFinite(ms)) return null;
  return { createdAt: new Date(ms), id };
}

function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.getTime()}_${id}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Math.max(1, Math.min(Number.isFinite(limitParam) ? limitParam : 30, 50));
  const cursor = decodeCursor(req.nextUrl.searchParams.get('cursor'));

  const space = await prisma.space.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!space) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const posts = await prisma.post.findMany({
    where: { spaceId: space.id, state: 'ACTIVE' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { createdAt_id: { createdAt: cursor.createdAt, id: cursor.id } },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      body: true,
      createdAt: true,
      profile: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore
    ? encodeCursor(items[items.length - 1]!.createdAt, items[items.length - 1]!.id)
    : null;

  return NextResponse.json({ ok: true, posts: items, nextCursor });
}
