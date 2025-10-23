import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Cursor is encoded as "<epochMs>_<postId>"
function decodeCursor(cur: string | null) {
  if (!cur) return null;
  const [ts, id] = cur.split('_');
  const n = Number(ts);
  if (!Number.isFinite(n) || !id) return null;
  return { createdAt: new Date(n), id };
}
function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.getTime()}_${id}`;
}

// GET /api/spaces/:slug/posts?limit=30&cursor=<ts_id>
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 30), 50));
  const cur = decodeCursor(url.searchParams.get('cursor'));

  const space = await prisma.space.findUnique({ where: { slug: params.slug } });
  if (!space) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const posts = await prisma.post.findMany({
    where: { spaceId: space.id, state: 'ACTIVE' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(cur ? { cursor: { createdAt_id: { createdAt: cur.createdAt, id: cur.id } }, skip: 1 } : {}),
    take: limit + 1,
    select: {
      id: true,
      body: true,
      createdAt: true,
      profile: { select: { id: true, handle: true, displayName: true } },
      // add fields you already use in feed item UI
    },
  });

  const hasMore = posts.length > limit;
  const slice = hasMore ? posts.slice(0, limit) : posts;
  const last = slice[slice.length - 1];
  const nextCursor = last ? encodeCursor(last.createdAt, last.id) : null;

  return NextResponse.json({ posts: slice, nextCursor });
}
