// src/components/media/ImageUploader.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/csrf-client';

type UploadState = 'idle' | 'signing' | 'uploading' | 'finalizing' | 'done' | 'error';

type UploadItem = {
  file: File;
  mediaId?: string;
  key?: string;
  localUrl?: string;   // local preview (blob:)
  status: UploadState;
  error?: string;
  urlThumb?: string;
  urlLarge?: string;
};

interface Props {
  scope: 'post' | 'dm';
  onChange(mediaIds: string[]): void;
}

export function ImageUploader({ scope, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UploadItem[]>([]);

  // Current UI constraint: single image per post (adjust if needed)
  const maxImages = 1;

  const maxMb = useMemo(
    () => Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB ?? process.env.UPLOAD_MAX_MB ?? 8),
    []
  );
  const BYTES_PER_MB = 1024 * 1024;

  // Notify parent only when the list of done IDs changes (prevents loops)
  const doneIds = useMemo(
    () => items.filter(i => i.status === 'done' && i.mediaId).map(i => i.mediaId!) as string[],
    [items]
  );
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onChangeRef.current(doneIds); }, [doneIds]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach(i => {
        if (i.localUrl?.startsWith('blob:')) URL.revokeObjectURL(i.localUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-process one idle item at a time (no auto-retry on errors)
  useEffect(() => {
    const busy = items.some(i => i.status === 'signing' || i.status === 'uploading' || i.status === 'finalizing');
    if (busy) return;
    const nextIx = items.findIndex(i => i.status === 'idle');
    if (nextIx !== -1) void uploadOne(nextIx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const remaining = Math.max(0, maxImages - items.length);

  const pickOne = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const f = files.item(0);
    if (!f) return;

    if (f.size > maxMb * BYTES_PER_MB) {
      const localUrl = URL.createObjectURL(f);
      setItems(prev => [
        ...prev,
        {
          file: f,
          localUrl,
          status: 'error',
          error: `File is ${(f.size / BYTES_PER_MB).toFixed(1)}MB; limit is ${maxMb}MB.`,
        },
      ]);
      return;
    }

    const localUrl = URL.createObjectURL(f);
    setItems(prev => [...prev, { file: f, localUrl, status: 'idle' }]);
  }, [maxMb]);

  const handleSelect: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    pickOne(e.target.files);
    // allow re-selecting the same file
    e.target.value = '';
  };

  function removeAt(ix: number) {
    setItems(prev => {
      const toRemove = prev[ix];
      if (toRemove?.localUrl?.startsWith('blob:')) URL.revokeObjectURL(toRemove.localUrl);
      return prev.filter((_, i) => i !== ix);
    });
  }

  async function safeJson(res: Response) {
    try { return await res.json(); } catch { return null; }
  }

  async function uploadOne(index: number) {
    const item = items[index];
    if (!item) return;

    // 1) SIGN
    setItems(prev => prev.map((it, i) => i === index ? { ...it, status: 'signing', error: undefined } : it));
    let sign: { url: string; mediaId: string; key: string } | null = null;

    try {
      const signRes = await apiFetch('/api/media/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: item.file.type,
          size: item.file.size,
          scope,
          name: item.file.name, // helps server infer ext
        }),
      });

      const raw = await safeJson(signRes);
      const url = raw?.url ?? raw?.uploadUrl;
      const mediaId = raw?.mediaId ?? raw?.id;
      const key = raw?.key ?? raw?.objectKey;
      const ok = Boolean(signRes.ok && (raw?.ok ?? true) && url && mediaId && key);

      if (!ok) throw new Error(raw?.error || `Sign failed (${signRes.status})`);
      sign = { url, mediaId, key };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign failed';
      setItems(prev => prev.map((it, i) => i === index ? { ...it, status: 'error', error: msg } : it));
      return;
    }

    // 2) PUT to S3  (← fixed the typo: ...tus → status)
    setItems(prev => prev.map((it, i) => i === index ? {
      ...it,
      status: 'uploading',
      key: sign!.key,
      mediaId: sign!.mediaId,
    } : it));

    const put = await fetch(sign.url, {
      method: 'PUT',
      headers: { 'Content-Type': item.file.type },
      body: item.file,
    });
    if (!put.ok) {
      const txt = await put.text().catch(() => '');
      setItems(prev => prev.map((it, i) => i === index ? { ...it, status: 'error', error: txt || `Upload failed (${put.status})` } : it));
      return;
    }

    // 3) FINALIZE
    setItems(prev => prev.map((it, i) => i === index ? { ...it, status: 'finalizing' } : it));
    try {
      const finRes = await apiFetch('/api/media/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: sign.mediaId,
          key: sign.key,
          contentType: item.file.type,
          sizeBytes: item.file.size,
        }),
      });
      const fin = await safeJson(finRes);
      if (!finRes.ok || !fin?.ok) throw new Error(fin?.error || `Finalize failed (${finRes.status})`);

      // Until thumbnailing exists, fall back to ORIGINAL url (server returns same for both)
      setItems(prev => prev.map((it, i) =>
        i === index
          ? {
              ...it,
              status: 'done',
              urlThumb: fin.urlThumb ?? it.localUrl,
              urlLarge: fin.urlLarge ?? it.localUrl,
            }
          : it
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Finalize failed';
      setItems(prev => prev.map((it, i) => i === index ? { ...it, status: 'error', error: msg } : it));
    }
  }

  const showRetry = items.some(i => i.status === 'error');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn"
          onClick={() => inputRef.current?.click()}
          disabled={remaining <= 0}
          aria-disabled={remaining <= 0}
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
        hidden
        onChange={handleSelect}
      />

      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-2">
            {items.map((it, index) => (
              <div key={`${index}-${it.mediaId ?? it.file.name}`} className="relative overflow-hidden rounded border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.urlThumb ?? it.localUrl} alt="" className="h-full w-full object-cover" />
                {it.status !== 'done' && it.status !== 'error' && (
                  <div className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
                    Uploading…
                  </div>
                )}
                {it.status === 'error' && (
                  <div className="absolute bottom-1 left-1 rounded bg-red-600/90 px-2 py-0.5 text-[11px] text-white">
                    {it.error || 'Upload failed'}
                  </div>
                )}
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white"
                  onClick={() => removeAt(index)}
                  aria-label="Remove image"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {showRetry && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="btn"
                onClick={() => setItems(prev => prev.map(i => (i.status === 'error' ? { ...i, status: 'idle' } : i)))}
              >
                Retry failed
              </button>
              <span className="text-xs text-gray-500">Only JPEG, PNG, or WebP up to {maxMb} MB.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
