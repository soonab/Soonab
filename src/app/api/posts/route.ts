// src/app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { Visibility } from '@prisma/client';
import { canCreatePost } from '@/lib/limits';
import { ensureSessionProfile } from '@/lib/identity';
import { getCurrentProfileId } from '@/lib/auth';
import { hasActivePostingPenalty } from '@/lib/moderation';
import { decodeCursor, encodeCursor } from '@/lib/pagination';
import { assertSameOrigin, requireJson } from '@/lib/security';
import { extractTags } from '@/lib/hashtags';

const POST_MAX = 500;

/** GET /api/posts — PUBLIC+ACTIVE, newest-first, cursor paginated. */
export async function GET(req: NextRequest) {
  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 100));
  const cur = decodeCursor(req.nextUrl.searchParams.get('cursor'));
  const where = { visibility: 'PUBLIC' as const, state: 'ACTIVE' as const };

  const items = await prisma.post.findMany({
    where: cur
      ? {
          ...where,
          OR: [
            { createdAt: { lt: new Date(cur.createdAt) } },
            { AND: [{ createdAt: new Date(cur.createdAt) }, { id: { lt: cur.id } }] },
          ],
        }
      : where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const nextCursor =
    items.length === limit
      ? encodeCursor({ createdAt: items[items.length - 1]!.createdAt.toISOString(), id: items[items.length - 1]!.id })
      : null;

  // Back-compat: keep `posts` while adding `items` + `nextCursor`
  return NextResponse.json({ ok: true, items, posts: items, nextCursor });
}

/** POST /api/posts — create */
export async function POST(req: NextRequest) {
  // Security posture
  assertSameOrigin(req);
  const payload = await requireJson<any>(req);

  const body = String(payload?.body ?? '').trim();
  if (!body) return NextResponse.json({ ok: false, error: 'Body is required' }, { status: 400 });
  if (body.length > POST_MAX) {
    return NextResponse.json({ ok: false, error: `Too long (max ${POST_MAX})` }, { status: 400 });
  }

  const jar = await cookies();
  let sid = jar.get('sid')?.value as string | undefined;
  let setCookie = false;
  if (!sid) { sid = randomUUID(); setCookie = true; }

  await ensureSessionProfile(sid);

  const profileId = await getCurrentProfileId(); // string | null

  const gate = await canCreatePost(sid, profileId ?? undefined);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 429 });

  if (profileId && (await hasActivePostingPenalty(profileId))) {
    return NextResponse.json({ ok: false, error: 'Posting disabled by moderation' }, { status: 403 });
  }

  const vRaw = String(payload?.visibility || 'PUBLIC').toUpperCase();
  const visibility: Visibility =
    (['PUBLIC', 'FOLLOWERS', 'TRUSTED'] as const).includes(vRaw as any) ? (vRaw as Visibility) : 'PUBLIC';

  const hashtags = extractTags(body);

  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: { sessionId: sid, profileId: profileId ?? null, body, visibility },
    });

    if (hashtags.length) {
      const tagRecords = await Promise.all(
        hashtags.map((name) =>
          tx.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          })
        )
      );

      if (tagRecords.length) {
        await tx.postTag.createMany({
          data: tagRecords.map((tag) => ({ postId: post.id, tagId: tag.id })),
          skipDuplicates: true,
        });
      }
    }

    return post;
  });

  const res = NextResponse.json({ ok: true, post: created, hashtags, quota: gate.quota ?? null });
  if (setCookie) {
    res.cookies.set('sid', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
