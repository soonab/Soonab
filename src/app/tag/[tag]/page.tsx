// src/app/tag/[tag]/page.tsx
export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import TagFeed, { ApiPost, ReputationInfo, SessionProfileInfo } from './TagFeed';

type ApiResponse = {
  ok: boolean;
  items: ApiPost[];
  nextCursor: string | null;
  sessionProfiles: SessionProfileInfo[];
  reputationScores: ReputationInfo[];
};

function getOrigin(): string {
  const hdrs = headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  if (!/^[a-zA-Z0-9_]+$/.test(decoded)) {
    notFound();
  }
  const normalized = decoded.toLowerCase();

  const origin = getOrigin();
  const res = await fetch(`${origin}/api/tags/${encodeURIComponent(normalized)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (res.status === 400) {
    notFound();
  }
  if (!res.ok) {
    throw new Error('Failed to load tag feed');
  }

  const data = (await res.json()) as ApiResponse;
  if (!data.ok) {
    throw new Error('Tag feed error');
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="card">
        <h1 className="text-xl font-semibold">#{normalized}</h1>
      </div>
      <TagFeed
        tag={normalized}
        initialItems={data.items}
        initialCursor={data.nextCursor}
        initialSessions={data.sessionProfiles}
        initialScores={data.reputationScores}
      />
    </main>
  );
}
