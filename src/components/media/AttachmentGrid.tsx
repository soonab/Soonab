// src/components/media/AttachmentGrid.tsx
'use client';

import type { SerializedAttachment } from '@/lib/media';

interface AttachmentGridProps {
  attachments: SerializedAttachment[] | null | undefined;
}

/**
 * Renders up to 4 images. Prefer 'LARGE' but gracefully fall back to 'ORIGINAL'
 * until thumbnailing adds explicit LARGE/THUMB variants.
 */
export function AttachmentGrid({ attachments }: AttachmentGridProps) {
  if (!attachments || attachments.length === 0) return null;

  const candidates = attachments.filter((a) => a.role === 'LARGE');
  const fallback = candidates.length ? candidates : attachments.filter((a) => a.role === 'ORIGINAL');
  if (!fallback.length) return null;

  const imgs = fallback.slice(0, 4);
  const cols = imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div className={`mt-2 grid ${cols} gap-2`}>
      {imgs.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${item.mediaId}-${item.url}`}
          src={item.url}
          alt=""
          className="h-full w-full rounded border object-cover"
          loading="lazy"
        />
      ))}
    </div>
  );
}
