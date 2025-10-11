'use client';
import { useState } from 'react';

export default function ReportButton(
  { targetType, targetId }: { targetType: 'POST' | 'REPLY', targetId: string }
) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function report() {
    if (done || busy) return;
    if (!confirm('Report this content?')) return;
    setBusy(true); setErr(null);
    const r = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType, targetId, reason: '' }),
    });
    setBusy(false);
    if (!r.ok) { setErr('Failed to report'); return; }
    setDone(true);
  }

  return (
    <div className="text-xs">
      {!done ? (
        <button onClick={report} disabled={busy} className="underline disabled:opacity-50">
          {busy ? 'Reporting…' : 'Report'}
        </button>
      ) : (
        <span className="text-gray-500">Reported</span>
      )}
      {err && <span className="ml-2 text-red-600">{err}</span>}
    </div>
  );
}
