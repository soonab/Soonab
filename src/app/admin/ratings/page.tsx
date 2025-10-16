// src/app/admin/ratings/page.tsx
import { prisma } from '@/lib/db';

export default async function RatingsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (key !== process.env.ADMIN_KEY) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-lg font-semibold">403 — Admin</h1>
        <p className="text-sm text-gray-500">Missing or wrong key.</p>
      </main>
    );
  }

  const ratings = await prisma.reputationRating.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const flags = await prisma.reputationFlag.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <section>
        <h1 className="text-xl font-semibold">Ratings – latest 100</h1>
        <ul className="mt-3 space-y-1 text-sm">
          {ratings.map((r) => (
            <li key={`${r.targetSessionId}:${r.raterSessionId}`}>
              <code>{new Date(r.updatedAt).toISOString()}</code> — rater{' '}
              <code>{(r.raterSessionId ?? '').slice(-4) || 'anon'}</code> → target{' '}
              <code>{(r.targetSessionId ?? '').slice(-4) || 'post'}</code> :{' '}
              <strong>{r.value}★</strong>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Flags</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {flags.map((f) => (
            <li key={f.id}>
              <code>{new Date(f.createdAt).toISOString()}</code> — target{' '}
              <code>{(f.targetSessionId ?? '').slice(-4) || 'post'}</code> :{' '}
              {f.reason} (count {f.count}) {f.resolved ? '✅' : '⚠️'}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
