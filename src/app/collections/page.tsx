export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import LoginCtaCard from '@/components/LoginCtaCard';

export default async function CollectionsHome() {
  const pid = await getCurrentProfileId();
  if (!pid) {
    return (
      <section className="space-y-4">
        <div className="panel p-6">
          <h1 className="text-xl font-bold mb-2">My collections</h1>
          <p className="text-[14px] text-[color:var(--ink-700)] mb-4">
            Sign in to create and manage your collections.
          </p>
          <LoginCtaCard />
        </div>
      </section>
    );
  }

  const rows = await prisma.collection.findMany({
    where: { ownerId: pid },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      slug: true,
      title: true,
      visibility: true,
      createdAt: true,
      _count: { select: { entries: true } },
    },
  });

  return (
    <section className="space-y-4">
      <div className="panel p-6">
        <h1 className="text-xl font-bold mb-3">My collections</h1>

        {rows.length === 0 ? (
          <p className="text-[14px] text-[color:var(--ink-700)]">
            You don’t have any collections yet. Use <span className="font-medium">“Add to Collection…”</span> on any post to create one.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((c) => (
              <li key={c.slug} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{c.title}</div>
                  <div className="text-[12px] text-[color:var(--ink-600)]">
                    {c.visibility} · {c._count.entries} items · {c.createdAt.toISOString().slice(0, 10)}
                  </div>
                </div>
                <a className="pill" href={`/c/${encodeURIComponent(c.slug)}`}>Open</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
