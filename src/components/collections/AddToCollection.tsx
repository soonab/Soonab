'use client';

import { useCallback, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/csrf-client';

type MyCollection = {
  slug: string;
  title: string;
  _count?: {
    entries: number;
  };
};

interface CollectionsResponse {
  collections?: MyCollection[];
}

export default function AddToCollection({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<MyCollection[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        setError(null);
        const res = await fetch('/api/collections?owner=me', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });

        if (cancelled) return;

        if (res.status === 401) {
          throw new Error('Sign in to use collections');
        }
        if (!res.ok) {
          throw new Error('Failed to load collections');
        }

        const data = (await res.json()) as CollectionsResponse;
        setCollections(data.collections ?? []);
      } catch (err) {
        if (cancelled) return;
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Unable to load collections');
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCollections([]);
      setSelected(null);
      setOk(null);
      setError(null);
    }
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const canSubmit = Boolean(selected) && !loading;

  async function add() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setOk(null);
    try {
      const res = await apiFetch(`/api/collections/${selected}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });

      if (res.status === 201) {
        setOk('Added to collection');
        return;
      }

      let message = `Failed with ${res.status}`;
      try {
        const json = await res.json();
        if (json?.error) {
          message = json.error;
        }
      } catch {
        // ignore JSON parse failures and use fallback message
      }
      throw new Error(message);
    } catch (err) {
      setError((err as Error).message || 'Failed to add to collection');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="underline text-xs disabled:opacity-50"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        Add to Collection…
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-md border border-[var(--line)] bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Add to Collection</h2>
                <p className="text-xs opacity-70">Choose one of your collections below.</p>
              </div>
              <button type="button" onClick={close} className="text-sm opacity-70">
                ✕
              </button>
            </div>

            {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
            {ok && <div className="mt-3 text-xs text-green-600">{ok}</div>}

            <div className="mt-4 max-h-52 space-y-2 overflow-auto text-sm">
              {collections.map((collection) => (
                <label
                  key={collection.slug}
                  className="flex cursor-pointer items-center gap-2 rounded border border-transparent p-2 hover:border-[var(--line)]"
                >
                  <input
                    type="radio"
                    name="collection"
                    value={collection.slug}
                    checked={selected === collection.slug}
                    onChange={() => setSelected(collection.slug)}
                  />
                  <span className="font-medium">{collection.title}</span>
                  {typeof collection._count?.entries === 'number' && (
                    <span className="ml-auto text-xs opacity-60">
                      {collection._count.entries} items
                    </span>
                  )}
                </label>
              ))}

              {collections.length === 0 && !error && (
                <div className="rounded border border-dashed border-[var(--line)] p-3 text-xs opacity-70">
                  You don’t have any collections yet.
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button type="button" onClick={close} className="underline">
                Cancel
              </button>
              <button
                type="button"
                onClick={add}
                disabled={!canSubmit}
                className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {loading ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
