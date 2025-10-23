// src/components/ReplyComposer.tsx
'use client';

import { useState, useTransition } from 'react';
import { ImageUploader } from '@/components/media/ImageUploader';

export default function ReplyComposer({
  postId,
  onPosted,
}: {
  postId: string;
  onPosted?: () => void;
}) {
  const [body, setBody] = useState('');
  const [assistive, setAssistive] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [pending, start] = useTransition();

  // API limit for typed content is 500 (images can be posted without text)
  const MAX = 500;

  const onPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (!assistive) {
      e.preventDefault();
      setMsg('Paste blocked. Enable Assistive Mode if needed.');
    }
  };

  const disabled = pending || (body.trim().length === 0 && mediaIds.length === 0);

  function submit() {
    const text = body.trim();
    if (!text && mediaIds.length === 0) {
      setMsg('Type something or attach an image.');
      return;
    }
    if (text.length > MAX) {
      setMsg(`Too long (max ${MAX} characters).`);
      return;
    }

    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text, mediaIds }),
      });

      if (res.status === 429) {
        setMsg('Daily reply limit reached.');
        return;
      }

      let j: any = null;
      try { j = await res.json(); } catch { /* ignore */ }

      if (!res.ok || !j?.ok) {
        setMsg(j?.error || `Something went wrong (${res.status}).`);
        return;
      }

      // Success
      setBody('');
      setMediaIds([]);
      setMsg(null);
      onPosted?.();
      // Strict chronological refresh
      location.reload();
    });
  }

  return (
    <div className="mt-3 rounded border p-3 space-y-2">
      <label className="block text-xs font-medium">Reply</label>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onPaste={onPaste}
        rows={3}
        maxLength={MAX}
        className="w-full rounded border p-2 outline-none"
        placeholder="Type your reply… (or attach an image below)"
        aria-label="Reply text"
      />

      <div className="flex items-center justify-between">
        <label className="text-xs">
          <input
            type="checkbox"
            className="mr-1"
            checked={assistive}
            onChange={(e) => setAssistive(e.target.checked)}
          />
          Assistive Mode (allows paste)
        </label>

        <span className="text-[11px] text-gray-500">{body.trim().length}/{MAX}</span>
      </div>

      {/* Image attachments */}
      <ImageUploader scope="post" onChange={setMediaIds} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="px-3 py-1.5 rounded-md bg-teal-700 text-white disabled:opacity-60"
          aria-disabled={disabled}
        >
          {pending ? 'Replying…' : 'Reply'}
        </button>
      </div>

      {msg && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}
