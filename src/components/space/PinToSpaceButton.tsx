'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/csrf-client';

type SpaceRole = 'OWNER' | 'MODERATOR' | 'MEMBER';

type MembershipResponse = {
  role: SpaceRole | null;
};

type PinnedListResponse = {
  pinned: { postId: string }[];
};

async function fetchRole(spaceSlug: string): Promise<SpaceRole | null> {
  const res = await fetch(`/api/spaces/${spaceSlug}/membership`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error('Failed to load membership');
  }
  const data = (await res.json()) as MembershipResponse;
  return data.role ?? null;
}

async function fetchIsPinned(spaceSlug: string, postId: string): Promise<boolean> {
  const res = await fetch(`/api/spaces/${spaceSlug}/pinned`, {
    credentials: 'same-origin',
  });
  if (!res.ok) {
    throw new Error('Failed to load pinned posts');
  }
  const data = (await res.json()) as PinnedListResponse;
  return Boolean(data.pinned?.some((item) => item.postId === postId));
}

export default function PinToSpaceButton({ spaceSlug, postId }: { spaceSlug: string; postId: string }) {
  const [role, setRole] = React.useState<SpaceRole | null>(null);
  const [isPinned, setIsPinned] = React.useState<boolean | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setMessage(null);
      try {
        const [nextRole, pinned] = await Promise.all([
          fetchRole(spaceSlug),
          fetchIsPinned(spaceSlug, postId),
        ]);
        if (cancelled) return;
        setRole(nextRole);
        setIsPinned(pinned);
      } catch (error) {
        if (cancelled) return;
        setMessage('Unable to load pin controls. Try again later.');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [spaceSlug, postId]);

  const canPin = role === 'OWNER' || role === 'MODERATOR';

  const handlePin = React.useCallback(async () => {
    setPending(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/spaces/${spaceSlug}/pinned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (res.ok) {
        setIsPinned(true);
      } else {
        setMessage('Unable to pin this post. Please try again.');
      }
    } catch (error) {
      setMessage('Unable to pin this post. Please try again.');
    } finally {
      setPending(false);
    }
  }, [spaceSlug, postId]);

  const handleUnpin = React.useCallback(async () => {
    setPending(true);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/spaces/${spaceSlug}/pinned/${postId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setIsPinned(false);
      } else {
        setMessage('Unable to unpin this post. Please try again.');
      }
    } catch (error) {
      setMessage('Unable to unpin this post. Please try again.');
    } finally {
      setPending(false);
    }
  }, [spaceSlug, postId]);

  if (!canPin) {
    return message ? <span className="text-xs text-red-600">{message}</span> : null;
  }

  if (isPinned === null) {
    return message ? <span className="text-xs text-red-600">{message}</span> : null;
  }

  return (
    <div className="flex items-center gap-2">
      {isPinned ? (
        <button className="btn btn-ghost btn-xs" onClick={handleUnpin} disabled={pending}>
          Unpin
        </button>
      ) : (
        <button className="btn btn-xs" onClick={handlePin} disabled={pending}>
          Pin
        </button>
      )}
      {message ? <span className="text-xs text-red-600">{message}</span> : null}
    </div>
  );
}
