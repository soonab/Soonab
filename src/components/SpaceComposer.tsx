'use client';

import { useState, useTransition } from 'react';
import { ImageUploader } from '@/components/media/ImageUploader';

export default function SpaceComposer({ spaceSlug, onPosted }: { spaceSlug: string; onPosted?: () => void }) {
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const disabled = pending || !text.trim();

  function submit() {
    start(async () => {
      const res = await fetch(`/api/spaces/${spaceSlug}/posts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text, mediaIds }),
      });
      if (!res.ok) return;
      setText('');
      setMediaIds([]);
      onPosted?.();
      location.reload(); // keep Space feed strictly chronological
    });
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <textarea
        className="w-full rounded border p-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Post to this Space…"
        maxLength={4000}
      />
      <div>
        <ImageUploader scope="post" onChange={setMediaIds} />
      </div>
      <div className="flex justify-end">
        <button
          disabled={disabled}
          onClick={submit}
          className="px-3 py-1.5 rounded-md bg-teal-700 text-white disabled:opacity-60"
        >
          Post to Space
        </button>
      </div>
    </div>
  );
}
