import { prisma } from '@/lib/db';

function ago(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

export default async function DiscoverSpacesPage() {
  // Server-side equivalent of the API (simple SSR list)
  const rows = await prisma.$queryRaw<
    { slug: string; name: string; lastPostAt: Date | null; posts24h: number }[]
  >`
    WITH post_stats AS (
      SELECT p."spaceId", MAX(p."createdAt") AS "lastPostAt",
             COUNT(*) FILTER (WHERE p."createdAt" >= NOW() - INTERVAL '24 hours') AS posts24h
      FROM "Post" p
      WHERE p."spaceId" IS NOT NULL
      GROUP BY p."spaceId"
    )
    SELECT s.slug, s.name, ps."lastPostAt", COALESCE(ps.posts24h, 0) as posts24h
    FROM "Space" s
    LEFT JOIN post_stats ps ON ps."spaceId" = s.id
    WHERE s.visibility='PUBLIC'
    ORDER BY ps."lastPostAt" DESC NULLS LAST
    LIMIT 50`;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Discover Spaces</h1>
      <p className="text-sm text-gray-600 mb-4">
        Suggestions are based on recent activity. Your Home feed stays chronological.
      </p>
      <ul className="space-y-3">
        {rows.map((r) => {
          const reason = r.lastPostAt
            ? `Active ${ago(Date.now() - r.lastPostAt.getTime())} — ${r.posts24h} posts today`
            : 'New Space — be first to post';
          return (
            <li key={r.slug} className="rounded border p-3 flex items-center justify-between">
              <div>
                <a href={`/space/${r.slug}`} className="font-medium hover:underline">{r.name}</a>
                <div className="text-xs text-gray-500">{reason}</div>
              </div>
              <a className="btn btn-xs" href={`/space/${r.slug}`}>View</a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
