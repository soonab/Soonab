// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { decodeCursor, encodeCursor } from '@/lib/pagination';

const querySchema = z.object({
  q: z.string().min(1).max(200),
});

const tagSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_]+$/);

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse({ q: req.nextUrl.searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query' }, { status: 400 });
  }

  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 100));
  const cursor = decodeCursor(req.nextUrl.searchParams.get('cursor'));

  const q = parsed.data.q.trim();
  if (!q) {
    return NextResponse.json({ ok: true, items: [], nextCursor: null });
  }

  if (q.startsWith('#')) {
    const tagPart = q.slice(1);
    const tagParse = tagSchema.safeParse(tagPart);
    if (!tagParse.success) {
      return NextResponse.json({ ok: true, items: [], nextCursor: null });
    }
    const tag = await prisma.tag.findUnique({ where: { name: tagParse.data.toLowerCase() } });
    if (!tag) {
      return NextResponse.json({ ok: true, items: [], nextCursor: null });
    }

    const baseWhere = {
      state: 'ACTIVE' as const,
      visibility: 'PUBLIC' as const,
      tags: { some: { tagId: tag.id } },
    };

    const cursorDate = cursor ? new Date(cursor.createdAt) : null;

    const items = await prisma.post.findMany({
      where: cursor
        ? {
            AND: [
              baseWhere,
              {
                OR: [
                  { createdAt: { lt: cursorDate! } },
                  { AND: [{ createdAt: cursorDate! }, { id: { lt: cursor.id } }] },
                ],
              },
            ],
          }
        : baseWhere,
      include: {
        replies: {
          where: { visibility: 'PUBLIC', state: 'ACTIVE' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const nextCursor =
      items.length === limit
        ? encodeCursor({
            createdAt: items[items.length - 1]!.createdAt.toISOString(),
            id: items[items.length - 1]!.id,
          })
        : null;

    const sessionIds = Array.from(
      new Set(
        items
          .flatMap((p) => [p.sessionId, ...p.replies.map((r) => r.sessionId)])
          .filter((v): v is string => Boolean(v))
      )
    );

    let sessionProfiles: { sessionId: string; handle: string }[] = [];
    let reputationScores: { sessionId: string; count: number; bayesianMean: number }[] = [];
    if (sessionIds.length) {
      [sessionProfiles, reputationScores] = await Promise.all([
        prisma.sessionProfile.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true, handle: true },
        }),
        prisma.reputationScore.findMany({
          where: { sessionId: { in: sessionIds } },
          select: { sessionId: true, count: true, bayesianMean: true },
        }),
      ]);
    }

    return NextResponse.json({ ok: true, items, nextCursor, sessionProfiles, reputationScores });
  }

  const baseWhere = {
    state: 'ACTIVE' as const,
    visibility: 'PUBLIC' as const,
    OR: [
      { body: { contains: q, mode: 'insensitive' as const } },
      { tags: { some: { tag: { name: { contains: q.toLowerCase(), mode: 'insensitive' } } } } },
    ],
  };

  const cursorDate = cursor ? new Date(cursor.createdAt) : null;

  const items = await prisma.post.findMany({
    where: cursor
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { createdAt: { lt: cursorDate! } },
                { AND: [{ createdAt: cursorDate! }, { id: { lt: cursor.id } }] },
              ],
            },
          ],
        }
      : baseWhere,
    include: {
      replies: {
        where: { visibility: 'PUBLIC', state: 'ACTIVE' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const nextCursor =
    items.length === limit
      ? encodeCursor({
          createdAt: items[items.length - 1]!.createdAt.toISOString(),
          id: items[items.length - 1]!.id,
        })
      : null;

  const sessionIds = Array.from(
    new Set(
      items
        .flatMap((p) => [p.sessionId, ...p.replies.map((r) => r.sessionId)])
        .filter((v): v is string => Boolean(v))
    )
  );

  let sessionProfiles: { sessionId: string; handle: string }[] = [];
  let reputationScores: { sessionId: string; count: number; bayesianMean: number }[] = [];
  if (sessionIds.length) {
    [sessionProfiles, reputationScores] = await Promise.all([
      prisma.sessionProfile.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { sessionId: true, handle: true },
      }),
      prisma.reputationScore.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { sessionId: true, count: true, bayesianMean: true },
      }),
    ]);
  }

  return NextResponse.json({ ok: true, items, nextCursor, sessionProfiles, reputationScores });
}
