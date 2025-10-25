import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';

function ago(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') || 8)));
  const me = await getCurrentProfileId();

  const excludeIds = me
    ? await prisma.$queryRaw<{ spaceId: string }[]>`
        SELECT "spaceId" FROM "SpaceMembership" WHERE "profileId" = ${me}
      `
    : [];
  const excluded = new Set(excludeIds.map((x) => x.spaceId));

  const rows = await prisma.$queryRaw<
    { id: string; slug: string; name: string; lastPostAt: Date | null; posts24h: number }[]
  >`
    WITH post_stats AS (
      SELECT p."spaceId", MAX(p."createdAt") AS "lastPostAt",
             COUNT(*) FILTER (WHERE p."createdAt" >= NOW() - INTERVAL '24 hours') AS posts24h
      FROM "Post" p
      WHERE p."spaceId" IS NOT NULL
      GROUP BY p."spaceId"
    )
    SELECT s.id, s.slug, s.name,
           ps."lastPostAt", COALESCE(ps.posts24h, 0) as posts24h
    FROM "Space" s
    LEFT JOIN post_stats ps ON ps."spaceId" = s.id
    WHERE s.visibility = 'PUBLIC'
    ORDER BY ps."lastPostAt" DESC NULLS LAST
    LIMIT ${limit * 3}
  `;

  const suggestions: { id: string; slug: string; name: string; reason: string }[] = [];
  for (const r of rows) {
    if (!r.id || excluded.has(r.id)) continue;
    const last = r.lastPostAt ? ago(Date.now() - r.lastPostAt.getTime()) : 'no recent posts';
    const reason = r.lastPostAt
      ? `Active ${last} — ${r.posts24h} posts today`
      : 'New Space — be first to post';
    suggestions.push({ id: r.id, slug: r.slug, name: r.name, reason });
    if (suggestions.length >= limit) break;
  }

  return NextResponse.json({ suggestions });
}
