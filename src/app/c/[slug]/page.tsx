export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { serializeAttachments } from '@/lib/media';
import CollectionMasonry from '@/components/collections/CollectionMasonry';
import ShareMenu from '@/components/share/ShareMenu';

export default async function CollectionPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;

  const col = await prisma.collection.findUnique({
    where: { slug },
    select: { id: true, title: true, visibility: true, createdAt: true, owner: { select: { handle: true } } },
  });
  if (!col) {
    return (
      <section className="panel p-6">
        <h1 className="text-xl font-bold mb-2">Collection not found</h1>
        <p className="text-[14px] text-[color:var(--ink-700)]">The collection you’re looking for does not exist.</p>
      </section>
    );
  }

  const rows = await prisma.collectionEntry.findMany({
    where: { collectionId: col.id },
    orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
    take: 24,
    select: {
      id: true,
      addedAt: true,
      post: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          visibility: true,
          state: true,
          media: { include: { media: { include: { variants: true } } } },
        },
      },
    },
  });

  const items = rows.map((r) => {
    const p = r.post;
    const hidden = !(p.state === 'ACTIVE' && p.visibility === 'PUBLIC');
    const attachments = hidden
      ? []
      : serializeAttachments(
          p.media.map((link) => ({
            id: link.mediaId,
            variants: link.media.variants.map((v) => ({
              role: v.role, key: v.key, width: v.width, height: v.height, contentType: v.contentType,
            })),
          }))
        );
    return {
      id: r.id,
      addedAt: r.addedAt.toISOString(),
      postId: p.id,
      createdAt: p.createdAt.toISOString(),
      hidden,
      body: hidden ? '' : p.body,
      attachments,
    };
  });

  return (
    <section className="space-y-4">
      <div className="panel p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{col.title}</h1>
            <div className="text-[12px] text-[color:var(--ink-600)]">
              {col.visibility} · by <a className="underline" href={`/s/${col.owner?.handle ?? 'anon'}`}>@{col.owner?.handle ?? 'anon'}</a> ·{' '}
              {new Date(col.createdAt).toISOString().slice(0, 10)}
            </div>
          </div>

          {/* Share entire collection */}
          <ShareMenu path={`/c/${encodeURIComponent(slug)}`} title={col.title} />
        </div>
      </div>

      <CollectionMasonry slug={slug} initialItems={items} />
    </section>
  );
}
