// src/app/api/posts/[id]/replies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { Visibility } from '@prisma/client';
import { canReply as canCreateReply } from '@/lib/limits'; // ✅ fixed import
import { ensureSessionProfile } from '@/lib/identity';
import { getCurrentProfileId } from '@/lib/auth';
import { hasActivePostingPenalty } from '@/lib/moderation';
import { decodeCursor, encodeCursor } from '@/lib/pagination';
import { assertSameOrigin, requireJson } from '@/lib/security';

const REPLY_MAX = 500;

// GET: list PUBLIC ACTIVE replies asc (cursor)
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await ctx.params;
  const limit = Math.max(
    1,
    Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 100)
  );
  const cur = decodeCursor(req.nextUrl.searchParams.get('cursor'));

  const base = {
    postId,
    state: 'ACTIVE' as const,
    visibility: 'PUBLIC' as const,
  };

  const items = await prisma.reply.findMany({
    where: cur
      ? {
          ...base,
          OR: [
            { createdAt: { gt: new Date(cur.createdAt) } },
            {
              AND: [
                { createdAt: new Date(cur.createdAt) },
                { id: { gt: cur.id } },
              ],
            },
          ],
        }
      : base,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
  });

  const nextCursor =
    items.length === limit
      ? encodeCursor({
          createdAt: items[items.length - 1]!.createdAt.toISOString(),
          id: items[items.length - 1]!.id,
        })
      : null;

  return NextResponse.json({ ok: true, items, nextCursor });
}

// POST: create reply (PUBLIC)
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  assertSameOrigin(req);
  const payload = await requireJson<any>(req);
  const { id: postId } = await ctx.params;

  const parent = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, state: true },
  });
  if (!parent)
    return NextResponse.json(
      { ok: false, error: 'Post not found' },
      { status: 404 }
    );
  if (parent.state !== 'ACTIVE') {
    return NextResponse.json(
      { ok: false, error: 'Cannot reply to a non-active post' },
      { status: 400 }
    );
  }

  const body = String(payload?.body ?? '').trim();
  if (!body)
    return NextResponse.json(
      { ok: false, error: 'Body is required' },
      { status: 400 }
    );
  if (body.length > REPLY_MAX) {
    return NextResponse.json(
      { ok: false, error: `Too long (max ${REPLY_MAX})` },
      { status: 400 }
    );
  }

  const jar = await cookies();
  let sid = jar.get('sid')?.value as string | undefined;
  let setCookie = false;
  if (!sid) {
    sid = randomUUID();
    setCookie = true;
  }

  await ensureSessionProfile(sid);
  const profileId = await getCurrentProfileId();

  const gate = await canCreateReply(sid, profileId ?? undefined, postId);
  if (!gate.ok)
    return NextResponse.json({ ok: false, error: gate.error }, { status: 429 });

  if (profileId && (await hasActivePostingPenalty(profileId))) {
    return NextResponse.json(
      { ok: false, error: 'Posting disabled by moderation' },
      { status: 403 }
    );
  }

  const created = await prisma.reply.create({
    data: {
      postId,
      sessionId: sid,
      profileId: profileId ?? null,
      body,
      visibility: Visibility.PUBLIC,
    },
  });

  const res = NextResponse.json({
    ok: true,
    reply: created,
    quota: gate.quota ?? null,
  });
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
