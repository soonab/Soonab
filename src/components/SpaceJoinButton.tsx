// src/components/SpaceJoinButton.tsx
'use client';

import { useState, useTransition } from 'react';
import { apiFetch } from '@/lib/csrf-client';

type Props = {
  slug: string;
  initialJoined?: boolean;
  signedIn: boolean;
};

export default function SpaceJoinButton({ slug, initialJoined = false, signedIn }: Props) {
  const [joined, setJoined] = useState(initialJoined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label = joined ? 'Leave Space' : 'Join Space';
  const busyLabel = joined ? 'Leaving…' : 'Joining…';

  function handleClick() {
    if (!signedIn) {
      if (typeof window !== 'undefined') {
        const returnTo = encodeURIComponent(`/space/${slug}`);
        window.location.href = `/login?returnTo=${returnTo}`;
      }
      return;
    }

    const action = joined ? 'leave' : 'join';
    startTransition(async () => {
      setError(null);
      try {
        const res = await apiFetch(`/api/spaces/${encodeURIComponent(slug)}/${action}`, {
          method: 'POST',
        });
        if (!res.ok) {
          let message = `Failed to ${action}`;
          try {
            const data = await res.json();
            if (data?.error) message = data.error;
          } catch (jsonErr) {
            void jsonErr; // ignore parse failures
          }
          setError(message);
          return;
        }
        setJoined(action === 'join');
      } catch (error) {
        void error;
        setError('Network error');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={pending}
      >
        {pending ? busyLabel : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
