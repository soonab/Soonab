// src/components/media/ImageUploader.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type UploadItem = {
  file: File;
  mediaId?: string;
  key?: string;
  status: 'idle' | 'signing' | 'uploading' | 'finalizing' | 'done' | 'error';
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
  const maxImages = useMemo(() => Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_IMAGES_PER_ITEM ?? process.env.UPLOAD_MAX_IMAGES_PER_ITEM ?? 4), []);
  const maxMb = useMemo(() => Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB ?? process.env.UPLOAD_MAX_MB ?? 8), []);

  useEffect(() => {
    onChange(items.filter((it) => it.status === 'done' && it.mediaId).map((it) => it.mediaId!));
  }, [items, onChange]);

  const remaining = maxImages - items.length;

  const pickFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .slice(0, Math.max(0, remaining))
      .map<UploadItem>((file) => ({ file, status: 'idle' }));
    if (!next.length) return;
    setItems((prev) => [...prev, ...next]);
  }, [remaining]);

  const handleSelect: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    pickFiles(e.target.files);
    e.target.value = '';
  };

  const removeAt = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadOne = async (index: number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, status: 'signing', error: undefined } : item)));
    const item = items[index];
    if (!item) return;
    try {
      const sign = await fetch('/api/media/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: item.file.type, size: item.file.size, scope }),
      });
      const signJson = await sign.json();
      if (!sign.ok || !signJson.ok) throw new Error(signJson.error || 'Unable to sign upload');

      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: 'uploading', key: signJson.key, mediaId: signJson.mediaId } : it)));

      const put = await fetch(signJson.url, {
        method: 'PUT',
        headers: { 'Content-Type': item.file.type },
        body: item.file,
      });
      if (!put.ok) throw new Error('Upload failed');

      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: 'finalizing' } : it)));

      const finalize = await fetch('/api/media/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: signJson.mediaId, key: signJson.key }),
      });
      const done = await finalize.json();
      if (!finalize.ok || !done.ok) throw new Error(done.error || 'Unable to finalize upload');

      setItems((prev) =>
        prev.map((it, i) =>
          i === index
            ? {
                ...it,
                status: 'done',
                urlThumb: done.urlThumb,
                urlLarge: done.urlLarge,
              }
            : it,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: 'error', error: message } : it)));
    }
  };

  const startUploads = async () => {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      if (item.status === 'idle' || item.status === 'error') {
        // eslint-disable-next-line no-await-in-loop
        await uploadOne(i);
      }
    }
  };

  const hasPending = items.some((item) => ['signing', 'uploading', 'finalizing'].includes(item.status));

  const gridCols = items.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    pickFiles(event.dataTransfer.files);
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-3" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="flex items-center gap-3">
        <button type="button" className="btn" onClick={() => inputRef.current?.click()} disabled={remaining <= 0}>
          Add images
        </button>
        <span className="text-xs text-gray-500">
          {Math.min(items.length, maxImages)} / {maxImages}
        </span>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleSelect} />
      {items.length > 0 && (
        <>
          <div className={`grid ${gridCols} gap-2`}>
            {items.slice(0, maxImages).map((item, index) => (
              <div key={`${index}-${item.mediaId ?? item.file.name}`} className="relative overflow-hidden rounded border bg-white">
                {item.urlThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.urlThumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center text-xs text-gray-500">
                    {item.status === 'error' ? item.error ?? 'Upload failed' : item.status === 'done' ? 'Processing…' : 'Ready to upload'}
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
          <div className="flex items-center justify-between">
            <button type="button" className="btn" onClick={startUploads} disabled={hasPending || items.length === 0}>
              Upload
            </button>
            <span className="text-xs text-gray-500">Only JPEG, PNG, or WebP up to {maxMb} MB each.</span>
          </div>
        </>
      )}
    </div>
  );
}
