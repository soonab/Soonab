import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { serializeAttachments } from '@/lib/media';

function decodeCursor(cur: string | null) {
  if (!cur) return null;
  const [ts, id] = cur.split('_');
  const n = Number(ts);
  return Number.isFinite(n) && id ? { createdAt: new Date(n), id } : null;
}
function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.getTime()}_${id}`;
}

// GET /api/spaces/:slug/posts?limit=30&cursor=<ts_id>
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 30)));
  const cur = decodeCursor(url.searchParams.get('cursor'));

  const space = await prisma.space.findUnique({ where: { slug }, select: { id: true } });
  if (!space) return NextResponse.json({ posts: [], nextCursor: null });

  const posts = await prisma.post.findMany({
    where: cur
      ? {
          spaceId: space.id,
          state: 'ACTIVE',
          OR: [
            { createdAt: { lt: new Date(cur.createdAt) } },
            { AND: [{ createdAt: new Date(cur.createdAt) }, { id: { lt: cur.id } }] },
          ],
        }
      : { spaceId: space.id, state: 'ACTIVE' },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      body: true,
      createdAt: true,
      profile: { select: { id: true, handle: true, displayName: true } },
      media: { include: { media: { include: { variants: true } } } },
    },
  });

  const slice = posts.slice(0, Math.min(limit, posts.length));
  const last = slice[slice.length - 1];
  const nextCursor = last ? encodeCursor(last.createdAt, last.id) : null;

  const mapped = slice.map((p) => {
    const attachments = serializeAttachments(
      p.media.map((link) => ({
        id: link.mediaId,
        variants: link.media.variants.map((v) => ({
          role: v.role,
          key: v.key,
          width: v.width,
          height: v.height,
          contentType: v.contentType,
        })),
      })),
    );
    return { ...p, attachments };
  });

  return NextResponse.json({ posts: mapped, nextCursor });
}
