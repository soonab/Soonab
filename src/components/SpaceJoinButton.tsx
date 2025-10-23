'use client';

import { useTransition, useState } from 'react';

export default function SpaceJoinButton({
  slug,
  initialJoined = false,
}: {
  slug: string;
  initialJoined?: boolean;
}) {
  const [pending, start] = useTransition();
  const [joined, setJoined] = useState(initialJoined);

  const act = (path: 'join' | 'leave') =>
    start(async () => {
      const res = await fetch(`/api/spaces/${slug}/${path}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) setJoined(path === 'join');
    });

  return (
    <button
      onClick={() => act(joined ? 'leave' : 'join')}
      className="px-4 py-2 rounded-md bg-teal-700 text-white disabled:opacity-60"
      disabled={pending}
      aria-pressed={joined}
    >
      {joined ? 'Leave Space' : 'Join Space'}
    </button>
  );
}
