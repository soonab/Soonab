'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/csrf-client';

type AcceptInviteResponse = {
  spaceSlug?: string;
  error?: string;
};

type AcceptInviteProps = {
  params: {
    token: string;
  };
};

export default function AcceptInvite({ params }: AcceptInviteProps) {
  const [msg, setMsg] = React.useState<string>('You’ve been invited to join this Space.');
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  async function accept() {
    setBusy(true);
    try {
      const res = await apiFetch('/api/spaces/invites/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: params.token }),
      });
      const data = (await res.json()) as AcceptInviteResponse;
      if (res.ok && data.spaceSlug) {
        router.replace(`/space/${data.spaceSlug}`);
        return;
      }
      setMsg(data.error || 'Could not accept invite. Please try again.');
    } catch (error) {
      setMsg('Something went wrong while accepting the invite. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-xl font-semibold">Accept Invite</h1>
      <p className="mb-4 text-sm text-gray-600">{msg}</p>
      <button className="btn" disabled={busy} onClick={accept}>
        {busy ? 'Joining…' : 'Join Space'}
      </button>
    </main>
  );
}
