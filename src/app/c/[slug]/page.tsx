export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import BodyText from '@/components/BodyText';

type CollectionEntry = {
  id: string;
  addedAt: string;
  post: {
    id: string;
    body: string;
  };
};

interface CollectionResponse {
  collection: {
    title: string;
    slug: string;
    counts: {
      total: number;
      visible: number;
      hidden: number;
    };
    entries: CollectionEntry[];
  };
}

async function getOrigin(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

async function fetchCollection(slug: string): Promise<CollectionResponse | null> {
  const origin = await getOrigin();
  const res = await fetch(`${origin}/api/collections/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error('Failed to load collection');
  }

  return (await res.json()) as CollectionResponse;
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const data = await fetchCollection(decodedSlug);

  if (!data) {
    notFound();
  }

  const { collection } = data;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{collection.title}</h1>
        <p className="text-sm opacity-70">
          {collection.counts.visible} items
        </p>
      </header>

      {collection.entries.length === 0 ? (
        <p className="text-sm text-gray-500">No posts in this collection yet.</p>
      ) : (
        <ul className="space-y-4">
          {collection.entries.map((entry) => (
            <li key={entry.id} className="card space-y-2 p-4">
              <div className="text-xs opacity-60">
                Added {new Date(entry.addedAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
              </div>
              <BodyText text={entry.post.body} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
