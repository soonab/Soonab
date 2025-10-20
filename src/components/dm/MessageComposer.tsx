// src/components/dm/MessageComposer.tsx
'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploader } from '@/components/media/ImageUploader';

interface MessageComposerProps {
  conversationId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export default function MessageComposer({ conversationId, disabled, disabledReason }: MessageComposerProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [uploaderKey, setUploaderKey] = useState(0);

  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [conversationId, disabled]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || busy) return;

    const text = body.trim();
    if (!text) {
      setError('Type a message first.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dm/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, mediaIds }),
      });
      if (res.status === 429) {
        const retry = res.headers.get('Retry-After');
        setError(retry ? `Cooldown in effect. Try again in ${retry}s.` : 'Cooldown in effect.');
      } else if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = (data && data.error) || 'Unable to send message';
        setError(message);
      } else {
        setBody('');
        setMediaIds([]);
        setUploaderKey((k) => k + 1);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" aria-disabled={disabled ? 'true' : undefined}>
      <label className="block text-sm font-medium" htmlFor="dm-message">
        Message
      </label>
      <textarea
        id="dm-message"
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 2000))}
        disabled={disabled || busy}
        rows={3}
        maxLength={2000}
        className="w-full rounded border border-[var(--outline)] bg-white p-2 text-sm text-[color:var(--ink-900)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
        aria-label="Direct message"
        aria-describedby={disabledReason ? 'dm-disabled-reason' : undefined}
      />
      {disabled && disabledReason && (
        <p id="dm-disabled-reason" className="text-sm text-gray-600">
          {disabledReason}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{body.length}/2000</span>
          <button type="submit" className="btn" disabled={disabled || busy}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
        <ImageUploader key={uploaderKey} scope="dm" onChange={setMediaIds} />
      </div>
    </form>
  );
}
