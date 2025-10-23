'use client';

import { useState, useTransition } from 'react';

export default function SpaceComposer({ spaceSlug, onPosted }: { spaceSlug: string; onPosted?: () => void }) {
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const disabled = pending || !text.trim();

  function submit() {
    start(async () => {
      const res = await fetch(`/api/spaces/${spaceSlug}/posts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        setText('');
        onPosted?.();
      }
    });
  }

  return (
    <div className="rounded-md border p-3 mb-4">
      <textarea
        className="w-full resize-y min-h-[90px] outline-none"
        placeholder={`Share something with #${spaceSlug}…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
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
