// File: src/app/api/posts/[id]/replies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { Visibility } from '@prisma/client';
import { canReply } from '@/lib/limits';
import { ensureSessionProfile } from '@/lib/identity';
import { getCurrentProfileId } from '@/lib/auth';
import { hasActivePostingPenalty } from '@/lib/moderation';
import { decodeCursor, encodeCursor } from '@/lib/pagination';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { extractTags } from '@/lib/hashtags';
import { serializeAttachments } from '@/lib/media';

export const dynamic = 'force-dynamic';

const REPLY_MAX = 500;

/** GET: list PUBLIC ACTIVE replies (asc, cursor) — includes attachments */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await cookies(); // dynamic
  const { id: postId } = await ctx.params;

  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 100));
  const cur = decodeCursor(req.nextUrl.searchParams.get('cursor'));

  const base = { postId, state: 'ACTIVE' as const, visibility: 'PUBLIC' as const };

  const rows = await prisma.reply.findMany({
    where: cur
      ? {
          ...base,
          OR: [
            { createdAt: { gt: new Date(cur.createdAt) } },
            { AND: [{ createdAt: new Date(cur.createdAt) }, { id: { gt: cur.id } }] },
          ],
        }
      : base,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      body: true,
      createdAt: true,
      sessionId: true,
      profileId: true,
      media: {                      // join media -> variants
        include: {
          media: {
            include: { variants: true },
          },
        },
      },
    },
  });

  // Map to API items with attachments[]
  const items = rows.map((r) => {
    const attachments = serializeAttachments(
      r.media.map((link) => ({
        id: link.mediaId,
        variants: link.media.variants.map((v) => ({
          role: v.role,
          key: v.key,
          width: v.width,
          height: v.height,
          contentType: v.contentType,
        })),
      }))
    );
    return {
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      profileId: r.profileId,
      sessionId: r.sessionId,
      attachments,
    };
  });

  const nextCursor =
    rows.length === limit
      ? encodeCursor({
          createdAt: rows[rows.length - 1]!.createdAt.toISOString(),
          id: rows[rows.length - 1]!.id,
        })
      : null;

  return NextResponse.json({ ok: true, items, nextCursor });
}

/** POST: create PUBLIC reply (+ optional mediaIds) — returns attachments */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await assertSameOrigin(req);
  await requireCsrf(req);
  await cookies(); // dynamic

  const payload = await requireJson<any>(req);
  const { id: postId } = await ctx.params;

  const parent = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, state: true },
  });
  if (!parent) return NextResponse.json({ ok: false, error: 'Post not found' }, { status: 404 });
  if (parent.state !== 'ACTIVE') {
    return NextResponse.json({ ok: false, error: 'Cannot reply to a non-active post' }, { status: 400 });
  }

  const body = String(payload?.body ?? '').trim();
  const mediaIds: string[] = Array.isArray(payload?.mediaIds) ? payload.mediaIds.filter(Boolean) : [];

  if (!body && mediaIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'Body or media required' }, { status: 400 });
  }
  if (body && body.length > REPLY_MAX) {
    return NextResponse.json({ ok: false, error: `Too long (max ${REPLY_MAX})` }, { status: 400 });
  }

  const jar = await cookies();
  let sid = jar.get('sid')?.value as string | undefined;
  let setCookie = false;
  if (!sid) { sid = randomUUID(); setCookie = true; }

  await ensureSessionProfile(sid);
  const profileId = await getCurrentProfileId();

  const gate = await canReply(sid, profileId ?? undefined, postId);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 429 });

  if (profileId && (await hasActivePostingPenalty(profileId))) {
    return NextResponse.json({ ok: false, error: 'Posting disabled by moderation' }, { status: 403 });
  }

  const hashtags = body ? extractTags(body) : [];

  const created = await prisma.$transaction(async (tx) => {
    const reply = await tx.reply.create({
      data: {
        postId,
        sessionId: sid,
        profileId: profileId ?? null,
        body,
        visibility: Visibility.PUBLIC,
      },
    });

    if (hashtags.length) {
      const tagRecords = await Promise.all(
        hashtags.map((name) =>
          tx.tag.upsert({ where: { name }, update: {}, create: { name } })
        )
      );
      if (tagRecords.length) {
        await tx.replyTag.createMany({
          data: tagRecords.map((tag) => ({ replyId: reply.id, tagId: tag.id })),
          skipDuplicates: true,
        });
      }
    }

    if (mediaIds.length) {
      await tx.replyMedia.createMany({
        data: mediaIds.map((mid) => ({ replyId: reply.id, mediaId: mid })),
        skipDuplicates: true,
      });
    }

    return reply;
  });

  // Build attachments for the response so the client can render immediately
  const mediaRows = mediaIds.length
    ? await prisma.media.findMany({
        where: { id: { in: mediaIds } },
        include: { variants: true },
      })
    : [];
  const attachments = serializeAttachments(
    mediaRows.map((m) => ({
      id: m.id,
      variants: m.variants.map((v) => ({
        role: v.role,
        key: v.key,
        width: v.width,
        height: v.height,
        contentType: v.contentType,
      })),
    }))
  );

  const res = NextResponse.json({ ok: true, reply: created, attachments, quota: gate.quota ?? null });
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
