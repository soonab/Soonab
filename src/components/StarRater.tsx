'use client';
import { useState } from 'react';

export default function StarRater({ targetHandle, disabled = false }:{
  targetHandle: string; disabled?: boolean;
}) {
  const [val, setVal] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(v:number) {
    if (busy || disabled) return;
    setBusy(true); setMsg(null); setVal(v);
    const r = await fetch('/api/reputation/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetHandle, value: v }),
    });
    setBusy(false);
    const j = await r.json();
    if (!j.ok) setMsg(j.error || 'Could not rate');
    else setMsg('Thanks — rating saved.');
  }

  return (
    <div className="text-xs">
      {[1,2,3,4,5].map(n => (
        <button key={n} onClick={() => submit(n)}
          className={`mx-0.5 ${val && n<=val ? '' : 'opacity-50'}`} disabled={busy || disabled}>
          ★
        </button>
      ))}
      {msg && <span className="ml-2">{msg}</span>}
    </div>
  );
}
