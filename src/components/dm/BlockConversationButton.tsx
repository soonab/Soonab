// src/components/dm/BlockConversationButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  conversationId: string;
  alreadyBlocked: boolean;
}

export default function BlockConversationButton({ conversationId, alreadyBlocked }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBlock() {
    if (busy || alreadyBlocked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dm/${conversationId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = (data && data.error) || 'Unable to block conversation';
        setError(message);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to block conversation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleBlock}
        disabled={busy || alreadyBlocked}
        className="btn-ghost text-red-600"
      >
        {alreadyBlocked ? 'Conversation blocked' : busy ? 'Blocking…' : 'Block conversation'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
