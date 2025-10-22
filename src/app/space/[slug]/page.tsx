// src/app/space/[slug]/page.tsx
export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import SpaceJoinButton from '@/components/SpaceJoinButton';
import SpaceComposer from '@/components/SpaceComposer';

type SpaceSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: Date;
  createdById: string;
};

async function getSpace(slug: string): Promise<SpaceSummary | null> {
  return prisma.space.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      createdAt: true,
      createdById: true,
    },
  });
}

async function getOrigin(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

type SpaceFeedPost = {
  id: string;
  body: string;
  createdAt: string;
  profile: {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
};

type SpaceFeedResponse = {
  ok?: boolean;
  posts: SpaceFeedPost[];
  nextCursor: string | null;
};

export default async function SpacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolvedSlug = decodeURIComponent(slug);
  const space = await getSpace(resolvedSlug);
  if (!space) {
    notFound();
  }

  const viewerProfileId = await getCurrentProfileId();
  const isOwner = viewerProfileId === space.createdById;
  const membership = viewerProfileId && !isOwner
    ? await prisma.spaceMembership.findUnique({
        where: {
          spaceId_profileId: {
            spaceId: space.id,
            profileId: viewerProfileId,
          },
        },
        select: { profileId: true },
      })
    : null;
  const isMember = isOwner || Boolean(membership);
  const signedIn = Boolean(viewerProfileId);

  let composer: ReactNode;
  if (isMember) {
    composer = <SpaceComposer spaceSlug={space.slug} />;
  } else if (!signedIn) {
    composer = (
      <div className="rounded-md border p-3 text-sm text-zinc-600">
        <Link className="underline" href={`/login?returnTo=${encodeURIComponent(`/space/${space.slug}`)}`}>
          Sign in
        </Link>{' '}
        to post in this space.
      </div>
    );
  } else {
    composer = (
      <div className="rounded-md border p-3 text-sm text-zinc-600">
        Join this space to share a post.
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-6">
          <header className="glass flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{space.name}</h1>
              {space.description && (
                <p className="text-sm text-zinc-600">{space.description}</p>
              )}
            </div>
            {!isOwner && (
              <SpaceJoinButton
                slug={space.slug}
                initialJoined={Boolean(membership)}
                signedIn={signedIn}
              />
            )}
          </header>

          <div>{composer}</div>

          <section className="space-y-4">
            <SpaceFeed slug={space.slug} />
          </section>
        </section>

        <aside className="space-y-4">
          <div className="rounded-md border p-4 text-sm text-zinc-700">
            <h2 className="text-base font-medium text-zinc-900">About this space</h2>
            <p className="mt-2 text-zinc-600">
              Created {new Date(space.createdAt).toLocaleDateString()}
            </p>
            <p className="mt-3">
              <Link className="text-teal-700 underline" href="/">
                Back to Home
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

async function SpaceFeed({ slug }: { slug: string }) {
  const origin = await getOrigin();
  const res = await fetch(`${origin}/api/spaces/${encodeURIComponent(slug)}/posts?limit=20`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Failed to load space posts');
  }

  const data = (await res.json()) as SpaceFeedResponse;
  const posts = Array.isArray(data.posts) ? data.posts : [];

  if (posts.length === 0) {
    return <p className="text-sm text-zinc-500">No posts yet.</p>;
  }

  return (
    <ul className="space-y-4">
      {posts.map((post) => {
        const created = new Date(post.createdAt).toLocaleString();
        const handle = post.profile?.handle;
        return (
          <li key={post.id} className="card space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{created}</span>
              {handle ? (
                <Link className="underline" href={`/s/${handle}`}>
                  @{handle}
                </Link>
              ) : (
                <span>anonymous</span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-800">{post.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
