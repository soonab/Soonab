// src/components/ReplyComposer.tsx
'use client';
import { useState } from 'react';
import type { Visibility } from '@prisma/client'

const VIS_OPTS: Visibility[] = ['PUBLIC', 'FOLLOWERS', 'TRUSTED']

export default function ReplyComposer({ postId }: { postId: string }) {
  const [body, setBody] = useState('');
  const [assistive, setAssistive] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (!assistive) { e.preventDefault(); setMsg('Paste blocked. Enable Assistive Mode if needed.'); }
  };

  async function submit() {
    const text = body.trim();
    if (!text) { setMsg('Type something first.'); return; }
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/posts/${postId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, visibility }),
    });
    setBusy(false);
    if (r.status === 429) { setMsg('Daily reply limit reached.'); return; }
    const j = await r.json();
    if (j.ok) { setBody(''); setMsg(null); location.reload(); }
    else { setMsg(j.error || 'Something went wrong.'); }
  }

  return (
    <div className="mt-3 rounded border p-2">
      <label className="block text-xs font-medium mb-1">Reply (typed only)</label>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onPaste={onPaste}
        rows={3}
        maxLength={500}
        className="w-full rounded border p-2 outline-none"
        placeholder="Type your reply…"
      />
      <div className="mt-2 flex items-center justify-between">
        <label className="text-xs">
          <input type="checkbox" className="mr-1" checked={assistive} onChange={e => setAssistive(e.target.checked)} />
          Assistive Mode (allows paste)
        </label>
        <div className="flex items-center gap-2">
          <select
            value={visibility}
            onChange={e => setVisibility(e.target.value as Visibility)}
            className="rounded border px-2 py-1 text-xs"
          >
            {VIS_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={submit} disabled={busy} className="rounded bg-black text-white px-3 py-1 text-sm disabled:opacity-50">
            {busy ? 'Replying…' : 'Reply'}
          </button>
        </div>
      </div>
      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </div>
  );
}
