'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type MyCollection = { slug: string; title: string; _count?: { entries: number } };

export default function CollectionsRailCard() {
  const [items, setItems] = useState<MyCollection[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/collections?owner=me', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Sign in to view collections' : 'Failed to load collections');
        const data = await r.json();
        if (!cancelled) setItems(data.collections ?? []);
      })
      .catch((e) => !cancelled && setErr(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="text-sm font-semibold mb-2">My Collections</div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {!items ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-600">
          No collections yet. Use <em>Add to Collection…</em> under any post, or{' '}
          <Link href="/collections" className="underline">create one</Link>.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {items.slice(0, 4).map((c) => (
              <li key={c.slug} className="flex items-center justify-between">
                <Link className="text-sm hover:underline" href={`/c/${c.slug}`}>
                  {c.title}
                </Link>
                <span className="text-xs text-gray-500">{c._count?.entries ?? 0}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Link href="/collections" className="text-sm underline underline-offset-2">View all</Link>
          </div>
        </>
      )}
    </div>
  );
}
