// src/components/media/AttachmentGrid.tsx
'use client';

import type { SerializedAttachment } from '@/lib/media';

interface AttachmentGridProps {
  attachments: SerializedAttachment[] | null | undefined;
}

export function AttachmentGrid({ attachments }: AttachmentGridProps) {
  if (!attachments || attachments.length === 0) return null;
  const filtered = attachments.filter((a) => a.role === 'LARGE');
  if (!filtered.length) return null;
  const imgs = filtered.slice(0, 4);
  const cols = imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  return (
    <div className={`mt-2 grid ${cols} gap-2`}>
      {imgs.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={`${item.mediaId}-${item.url}`} src={item.url} alt="" className="h-full w-full rounded border object-cover" loading="lazy" />
      ))}
    </div>
  );
}
