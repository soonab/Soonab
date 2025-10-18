// src/components/dm/ReportConversationForm.tsx
'use client';

import { FormEvent, useState } from 'react';

export default function ReportConversationForm({ conversationId }: { conversationId: string }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || sent) return;
    const text = reason.trim();
    if (!text) {
      setError('Explain what happened.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dm/${conversationId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = (data && data.error) || 'Unable to submit report';
        setError(message);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit report');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="dm-report" className="block text-sm font-medium">
        Report conversation
      </label>
      <textarea
        id="dm-report"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        disabled={busy || sent}
        rows={3}
        maxLength={500}
        className="w-full rounded border border-[var(--outline)] bg-white p-2 text-sm text-[color:var(--ink-900)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-teal)]"
        placeholder="Share details for moderators (required)"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sent && <p className="text-sm text-green-700">Thank you. Our team will review.</p>}
      <button type="submit" className="btn" disabled={busy || sent}>
        {sent ? 'Report sent' : busy ? 'Sending…' : 'Send report'}
      </button>
    </form>
  );
}
