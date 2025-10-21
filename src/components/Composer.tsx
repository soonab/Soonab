// src/components/Composer.tsx
'use client';

import { useState } from 'react';
import type { Visibility } from '@prisma/client';
import { ImageUploader } from '@/components/media/ImageUploader';
import { apiFetch } from '@/lib/csrf-client';

const VIS_OPTS: Visibility[] = ['PUBLIC', 'FOLLOWERS', 'TRUSTED'];
const POST_MAX = 500;

async function submitPost(payload: { body: string; visibility: Visibility; mediaIds?: string[] }) {
  const res = await apiFetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let errMsg = `Post failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) errMsg = j.error;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

export default function Composer() {
  const [body, setBody] = useState('');
  const [assistive, setAssistive] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [uploaderKey, setUploaderKey] = useState(0);

  const onPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (!assistive) {
      e.preventDefault();
      setMsg('Paste blocked to encourage typed input. Toggle Assistive Mode if needed.');
    }
  };

  async function submit() {
    const text = body.trim();
    if (!text) { setMsg('Type something first.'); return; }
    if (text.length > POST_MAX) { setMsg(`Too long (max ${POST_MAX}).`); return; }

    setBusy(true); setMsg(null);
    try {
      const data = await submitPost({ body: text, visibility, mediaIds });
      // Reset on success
      setBody(''); setMediaIds([]); setUploaderKey(k => k + 1); setMsg(null);
      // Reload to show the new post at the top (chronological feed)
      location.reload();
    } catch (e: any) {
      if (String(e?.message || '').toLowerCase().includes('429')) {
        setMsg('Posting quota reached.');
      } else {
        setMsg(e?.message || 'Something went wrong.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border p-3">
      <label className="block text-sm font-medium mb-1">Compose (typed only)</label>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onPaste={onPaste}
        rows={4}
        maxLength={POST_MAX}
        className="w-full rounded border p-2 outline-none"
        placeholder="Type your thought… #hashtags work"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs">
            <input type="checkbox" className="mr-1" checked={assistive} onChange={e => setAssistive(e.target.checked)} />
            Assistive Mode (allows paste)
          </label>
          <label className="text-xs">
            <span className="mr-1">Visibility:</span>
            <select
              value={visibility}
              onChange={e => setVisibility(e.target.value as Visibility)}
              className="rounded border px-2 py-1 text-xs"
            >
              {VIS_OPTS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <button onClick={submit} disabled={busy} className="rounded bg-black text-white px-3 py-1 text-sm disabled:opacity-50">
          {busy ? 'Posting…' : 'Post'}
        </button>
      </div>

      <div className="mt-3">
        {/* Your uploader is configured for 1 image; backend allows up to env limit. */}
        <ImageUploader key={uploaderKey} scope="post" onChange={setMediaIds} />
      </div>

      {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
    </div>
  );
}
