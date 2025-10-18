// src/components/dm/AcceptInviteButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AcceptInviteButton({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dm/${conversationId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = (data && data.error) || 'Unable to accept invite';
        setError(message);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invite');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={accept}
        disabled={busy}
        className="btn"
      >
        {busy ? 'Accepting…' : 'Accept invite'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
