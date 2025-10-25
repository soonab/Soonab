'use client';

import * as React from 'react';

import { apiFetch } from '@/lib/csrf-client';

type Visibility = 'PUBLIC' | 'INVITE';

type MembershipResponse = {
  isMember?: boolean;
  visibility?: Visibility;
  error?: unknown;
};

async function fetchMembership(slug: string): Promise<MembershipResponse> {
  try {
    const res = await fetch(`/api/spaces/${slug}/membership`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return { error: true };
    return (await res.json()) as MembershipResponse;
  } catch (error) {
    return { error };
  }
}

export default function JoinSpaceButton({ slug }: { slug: string }) {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [isMember, setIsMember] = React.useState<boolean>(false);
  const [visibility, setVisibility] = React.useState<Visibility>('PUBLIC');
  const [message, setMessage] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState<boolean>(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const data = await fetchMembership(slug);
    if (!data.error) {
      setIsMember(Boolean(data.isMember));
      setVisibility(data.visibility ?? 'PUBLIC');
    }
    setLoading(false);
  }, [slug]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const join = React.useCallback(async () => {
    setMessage(null);
    setJoining(true);
    const res = await apiFetch(`/api/spaces/${slug}/join`, {
      method: 'POST',
    });
    if (res.ok) {
      await refresh();
    } else {
      setMessage('Join failed (invite might be required).');
    }
    setJoining(false);
  }, [refresh, slug]);

  if (loading) {
    return <span className="text-xs text-gray-500">Loading…</span>;
  }

  if (isMember) {
    return <span className="rounded-full border px-2 py-1 text-xs">Joined</span>;
  }

  if (visibility === 'INVITE') {
    return <span className="rounded-full border px-2 py-1 text-xs">Invite-only</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <button className="btn btn-xs" onClick={join} disabled={joining}>
        Join
      </button>
      {message ? <span className="text-xs text-red-600">{message}</span> : null}
    </div>
  );
}
