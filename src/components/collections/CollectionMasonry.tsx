'use client';

import * as React from 'react';
import BodyText from '@/components/BodyText';
import { AttachmentGrid } from '@/components/media/AttachmentGrid';
import ShareMenu from '@/components/share/ShareMenu';
import type { SerializedAttachment } from '@/lib/media';
import styles from './masonry.module.css';

type MasonryItem = {
  id: string;
  postId: string;
  addedAt: string;
  createdAt: string;
  hidden: boolean;
  body: string | null;
  attachments: SerializedAttachment[] | null | undefined;
};

type CollectionMasonryProps = {
  slug: string;
  initialItems: MasonryItem[];
};

const SCROLL_MARGIN_PX = 1200;
const INITIAL_FETCH_LIMIT = 24;

export default function CollectionMasonry({ slug, initialItems }: CollectionMasonryProps) {
  const [items, setItems] = React.useState<MasonryItem[]>(initialItems);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Prime nextCursor once mounted
  React.useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/collections/${encodeURIComponent(slug)}?limit=${INITIAL_FETCH_LIMIT}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { nextCursor?: string | null };
        if (!ignore) setCursor(data.nextCursor ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      ignore = true;
    };
  }, [slug]);

  // If a hash like #e-<entryId> is present, scroll to it after paint
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.location.hash?.slice(1);
    if (!id) return;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const timeout = window.setTimeout(tryScroll, 50);
    return () => window.clearTimeout(timeout);
  }, []);

  // Infinite scroll
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done) return;

    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting || loading || !cursor || done) return;
        setLoading(true);
        try {
          const res = await fetch(
            `/api/collections/${encodeURIComponent(slug)}?limit=${INITIAL_FETCH_LIMIT}&cursor=${encodeURIComponent(cursor)}`,
            {
              credentials: 'include',
              cache: 'no-store',
            }
          );
          if (!res.ok) {
            setDone(true);
            return;
          }
          const data = (await res.json()) as { items?: MasonryItem[]; nextCursor?: string | null };
          const newItems = data.items ?? [];
          setItems((prev) => [...prev, ...newItems]);
          setCursor(data.nextCursor ?? null);
          if (!data.nextCursor || newItems.length === 0) setDone(true);
        } catch {
          setDone(true);
        } finally {
          setLoading(false);
        }
      },
      { rootMargin: `${SCROLL_MARGIN_PX}px 0px ${SCROLL_MARGIN_PX}px 0px` }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [slug, cursor, loading, done]);

  return (
    <>
      <ul className={styles.masonry}>
        {items.map((item) => {
          const sharePath = `/c/${encodeURIComponent(slug)}#e-${item.id}`;
          const shareTitle = item.body ? item.body.slice(0, 120) : undefined;
          return (
            <li key={item.id} id={`e-${item.id}`} className={styles.masonryItem}>
              <article className="group relative overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10">
                {/* Subtle top/bottom gradient on hover */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-11 bg-gradient-to-b from-black/15 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/15 to-transparent opacity-0 transition group-hover:opacity-100" />
                {/* Tile Share (hover) */}
                <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                  <ShareMenu path={sharePath} title={shareTitle} compact className="pointer-events-auto" />
                </div>

                {item.hidden ? (
                  <div className="grid h-40 place-items-center bg-[color:var(--ink-100)] text-[12px] text-[color:var(--ink-600)]">
                    This post is hidden
                  </div>
                ) : (
                  <AttachmentGrid attachments={item.attachments} />
                )}

                {item.body ? (
                  <div className="p-3">
                    <BodyText text={item.body} />
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ul>

      <div ref={sentinelRef} className="h-2" />
      {loading ? <div className="my-4 text-center text-[12px] text-[color:var(--ink-600)]">Loading…</div> : null}
      {done && items.length === 0 ? (
        <div className="panel my-6 p-6 text-center text-[14px] text-[color:var(--ink-700)]">No visible items yet.</div>
      ) : null}
    </>
  );
}
