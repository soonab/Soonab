import Link from 'next/link';
import { prisma } from '@/lib/db';
import ScoreBadge from '@/components/ScoreBadge';

export default async function Top() {
  const minCount = Number(process.env.REP_TOP_MIN_COUNT ?? 5);
  const top = await prisma.reputationScore.findMany({
    where: { count: { gte: minCount } },
    orderBy: { bayesianMean: 'desc' },
    take: 50,
  });
  const profiles = await prisma.sessionProfile.findMany({
    where: { sessionId: { in: top.map(t => t.sessionId) } },
  });
  const bySid = new Map(profiles.map(p => [p.sessionId, p]));
  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="text-xl font-semibold mb-4">Top</h1>
      <ul className="space-y-2">
        {top.map(t => {
          const p = bySid.get(t.sessionId)!;
          return (
            <li key={t.sessionId} className="flex items-center gap-3">
              <Link href={`/s/${p.handle}`} className="underline">@{p.handle}</Link>
              <ScoreBadge bm={t.bayesianMean} count={t.count} />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
