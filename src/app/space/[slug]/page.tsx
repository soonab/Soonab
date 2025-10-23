import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import SpaceJoinButton from '@/components/SpaceJoinButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getSpace(slug: string) {
  return prisma.space.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, description: true, createdAt: true },
  });
}

export default async function SpacePage({ params }: { params: { slug: string } }) {
  const space = await getSpace(params.slug);
  if (!space) return <div className="p-6">Space not found.</div>;

  const profileId = await getCurrentProfileId();
  const joined = profileId
    ? !!(await prisma.spaceMembership.findUnique({
        where: { spaceId_profileId: { spaceId: space.id, profileId } },
        select: { id: true },
      }))
    : false;

  // Server render first page via the API (keeps logic in one place)
  const base = process.env.NEXT_PUBLIC_SITE_URL || '';
  const res = await fetch(`${base}/api/spaces/${space.slug}/posts?limit=20`, { cache: 'no-store' });
  const data = await res.json();

  return (
    <main className="container mx-auto px-4 py-6 grid grid-cols-12 gap-6">
      <section className="col-span-8">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">{space.name}</h1>
            {space.description && <p className="text-sm text-zinc-600">{space.description}</p>}
          </div>
          <SpaceJoinButton slug={space.slug} initialJoined={joined} />
        </header>

        <ul className="space-y-4">
          {data.posts?.map((p: any) => (
            <li key={p.id} className="rounded-md border p-4">
              <div className="text-sm text-zinc-500">{new Date(p.createdAt).toLocaleString()}</div>
              <div className="font-medium">@{p.author?.handle}</div>
              <p className="whitespace-pre-wrap">{p.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="col-span-4">
        <div className="rounded-md border p-4">
          <h2 className="font-medium mb-2">About this Space</h2>
          <p className="text-sm text-zinc-600">
            Created {new Date(space.createdAt).toLocaleDateString()}
          </p>
          <Link className="text-sm text-teal-700" href="/">Back to Home</Link>
        </div>
      </aside>
    </main>
  );
}
