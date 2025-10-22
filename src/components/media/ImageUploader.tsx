// src/components/media/ImageUploader.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/csrf-client';

type UploadStatus = 'idle' | 'signing' | 'uploading' | 'finalizing' | 'done' | 'error';

type UploadItem = {
  file: File;
  localUrl?: string;
  mediaId?: string;
  key?: string;
  status: UploadStatus;
  error?: string;
  urlThumb?: string;
  urlLarge?: string;
};

interface ImageUploaderProps {
  scope: 'post' | 'dm';
  onChange(mediaIds: string[]): void;
}

export function ImageUploader({ scope, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);

  // UI shows one image for now; backend may allow more.
  const maxImages = 1;
  const maxMb = useMemo(
    () => Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB ?? process.env.UPLOAD_MAX_MB ?? 8),
    []
  );

  // Emit selected (finished) media IDs to the composer
  useEffect(() => {
    onChange(items.filter((it) => it.status === 'done' && it.mediaId).map((it) => it.mediaId!));
  }, [items, onChange]);

  const remaining = Math.max(0, maxImages - items.length);

  const pickOne = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files.item(0);
    if (!file) return;

    const localUrl = URL.createObjectURL(file);

    // Add immediately with local preview
    setItems((prev) => [...prev, { file, localUrl, status: 'idle' }]);

    // Auto‑start upload for the just‑added file
    const index = items.length; // position it will land in after setState
    // Defer to next tick so state is applied
    setTimeout(() => void uploadOne(index), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handleSelect: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    pickOne(e.target.files);
    // allow picking the same file again
    e.target.value = '';
  };

  const removeAt = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Be lenient parsing JSON for edge cases
  async function safeJson(res: Response) {
    try {
      return await res.json();
    } catch {
      try {
        const t = await res.text();
        return t ? { ok: false, error: t } : null;
      } catch {
        return null;
      }
    }
  }

  const uploadOne = async (index: number) => {
    const current = items[index];
    if (!current) return;

    // signing
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: 'signing', error: undefined } : it)));

    try {
      // 1) SIGN to get pre‑signed PUT URL (CSRF protected)
      const signRes = await apiFetch('/api/media/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: current.file.name,
          contentType: current.file.type,
          size: current.file.size,
          scope, // 'post' | 'dm'
        }),
      });
      const s = await safeJson(signRes);
      if (!signRes.ok || !s?.ok || !s?.url) {
        const msg = s?.error || `Sign failed (${signRes.status})`;
        throw new Error(msg);
      }

      setItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, status: 'uploading', key: s.key, mediaId: s.mediaId } : it))
      );

      // 2) PUT file directly to S3 (no CSRF needed)
      const put = await fetch(s.url, {
        method: 'PUT',
        headers: { 'Content-Type': current.file.type },
        body: current.file,
      });
      if (!put.ok) {
        const txt = await put.text().catch(() => '');
        throw new Error(txt || `Upload failed (${put.status})`);
      }

      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: 'finalizing' } : it)));

      // 3) FINALIZE (records metadata & returns public URLs)
      const finRes = await apiFetch('/api/media/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: s.mediaId,
          key: s.key,
          contentType: current.file.type,
          sizeBytes: current.file.size,
          scope,
        }),
      });
      const done = await safeJson(finRes);
      if (!finRes.ok || !done?.ok) {
        const msg = done?.error || `Finalize failed (${finRes.status})`;
        throw new Error(msg);
      }

      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                status: 'done',
                urlThumb: done.urlThumb,
                urlLarge: done.urlLarge,
              }
            : it
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: 'error', error: message } : it)));
    }
  };

  // Drag‑drop support (auto‑uploads too)
  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    pickOne(event.dataTransfer.files);
  };
  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
  };

  const hasPending = items.some((it) => it.status !== 'done' && it.status !== 'error');

  return (
    <div className="space-y-3" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn"
          onClick={() => inputRef.current?.click()}
          disabled={remaining <= 0 || hasPending}
        >
          Add image
        </button>
        <span className="text-xs text-gray-500">
          {Math.min(items.length, maxImages)} / {maxImages}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={false}
        hidden
        onChange={handleSelect}
      />

      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-2">
            {items.map((item, index) => (
              <div key={`${index}-${item.mediaId ?? item.file.name}`} className="relative overflow-hidden rounded border bg-white">
                {/** Preview: prefer finalized URL, else S3 object URL, else local blob */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.urlThumb || item.urlLarge || item.localUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {/* Tiny overlay for state/errors; kept subtle */}
                {item.status !== 'done' && item.status !== 'error' && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/40 px-2 py-1 text-[11px] text-white">
                    Uploading…
                  </div>
                )}
                {item.status === 'error' && (
                  <div className="absolute inset-x-0 bottom-0 bg-red-600/80 px-2 py-1 text-[11px] text-white">
                    {item.error ?? 'Upload failed'}
                  </div>
                )}
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white"
                  onClick={() => removeAt(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* The original composer shows an "Upload" button — keep it, but it's not required now */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="btn"
              onClick={() => uploadOne(0)}
              disabled={hasPending || items.length === 0}
            >
              Upload
            </button>
            <span className="text-xs text-gray-500">Only JPEG, PNG, or WebP up to {maxMb} MB.</span>
          </div>
        </>
      )}
    </div>
  );
}
