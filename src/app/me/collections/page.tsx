export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';

export default async function MyCollectionsPage() {
  const pid = await getCurrentProfileId();
  if (!pid) {
    return (
      <section className="panel p-6">
        <h1 className="text-lg font-bold mb-2">My collections</h1>
        <p className="text-[14px]">Please sign in to view your collections.</p>
      </section>
    );
  }

  const cols = await prisma.collection.findMany({
    where: { ownerId: pid },
    orderBy: [{ createdAt: 'desc' }],
    select: { slug: true, title: true, visibility: true, _count: { select: { entries: true } }, createdAt: true },
  });

  return (
    <section className="space-y-4">
      <div className="panel p-6">
        <h1 className="text-lg font-bold mb-2">My collections</h1>
        <p className="text-[13px] text-[color:var(--ink-700)]">Your boards, newest first.</p>
      </div>

      <div className="panel p-0">
        <ul className="divide-y">
          {cols.map((c) => (
            <li key={c.slug} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{c.title}</div>
                <div className="text-[12px] text-[color:var(--ink-600)]">
                  {c.visibility} · {c._count.entries} items · {new Date(c.createdAt).toISOString().slice(0, 10)}
                </div>
              </div>
              <a className="pill" href={`/c/${encodeURIComponent(c.slug)}`}>
                Open
              </a>
            </li>
          ))}
          {cols.length === 0 && (
            <li className="p-4 text-[13px] text-[color:var(--ink-700)]">No collections yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
