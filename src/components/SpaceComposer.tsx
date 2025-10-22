// src/components/SpaceComposer.tsx
'use client';

import { useState, useTransition } from 'react';
import { apiFetch } from '@/lib/csrf-client';

type Props = {
  spaceSlug: string;
};

export default function SpaceComposer({ spaceSlug }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = text.trim();
  const disabled = pending || trimmed.length === 0;

  function submit() {
    if (!trimmed || pending) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await apiFetch(`/api/spaces/${encodeURIComponent(spaceSlug)}/posts/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed }),
        });
        if (!res.ok) {
          let message = `Post failed (${res.status})`;
          try {
            const data = await res.json();
            if (data?.error) message = data.error;
          } catch (jsonErr) {
            void jsonErr;
          }
          setError(message);
          return;
        }
        setText('');
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      } catch (error) {
        void error;
        setError('Network error');
      }
    });
  }

  return (
    <div className="rounded-md border p-3">
      <textarea
        className="min-h-[90px] w-full resize-y rounded-md border px-3 py-2 text-sm outline-none"
        placeholder={`Share something with ${spaceSlug}…`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={submit}
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? 'Posting…' : 'Post to Space'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
