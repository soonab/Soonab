// src/app/api/tags/[tag]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { decodeCursor, encodeCursor } from '@/lib/pagination';

const paramsSchema = z.object({
  tag: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tag: string }> }
) {
  const { tag: rawTag } = paramsSchema.parse(await ctx.params);
  const tagName = rawTag.toLowerCase();

  const tag = await prisma.tag.findUnique({ where: { name: tagName } });
  if (!tag) {
    return NextResponse.json({ ok: true, items: [], nextCursor: null });
  }

  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 100));
  const cursor = decodeCursor(req.nextUrl.searchParams.get('cursor'));

  const baseWhere = {
    state: 'ACTIVE' as const,
    visibility: 'PUBLIC' as const,
    tags: { some: { tagId: tag.id } },
  };

  const items = await prisma.post.findMany({
    where: cursor
      ? {
          ...baseWhere,
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { AND: [{ createdAt: new Date(cursor.createdAt) }, { id: { lt: cursor.id } }] },
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
