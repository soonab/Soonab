// UPDATE: choose existing, or create & add; SSR-safe headers
'use client';

import * as React from 'react';

type CollectionRow = { slug: string; title: string; visibility: 'PUBLIC' | 'PRIVATE'; _count?: { entries: number } };

function getCsrfHeaders() {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="csrf"]') as HTMLMetaElement | null;
    const token = meta?.content || (typeof window !== 'undefined' ? (window as any).__CSRF : undefined);
    if (token) { h['X-CSRF'] = token; h['X-CSRF-Token'] = token; }
  }
  return h;
}

export default function AddToCollection({ postId }: { postId: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [collections, setCollections] = React.useState<CollectionRow[]>([]);
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'choose' | 'create'>('choose');
  const [title, setTitle] = React.useState('');
  const [visibility, setVisibility] = React.useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function loadCollections() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch('/api/collections?owner=me', { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      const rows: CollectionRow[] = j.items ?? j.collections ?? [];
      setCollections(rows);
      if (rows.length) { setSelectedSlug(rows[0]!.slug); setMode('choose'); }
      else { setMode('create'); }
    } catch (e: any) { setMsg(e.message || 'Error loading collections'); }
    finally { setLoading(false); }
  }

  function onOpen() { setOpen(true); setMsg(null); setBusy(false); loadCollections(); }
  function onClose() { setOpen(false); setMsg(null); setBusy(false); }

  async function createAndMaybeAdd(alsoAdd: boolean) {
    if (!title.trim()) { setMsg('Please enter a title'); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST', credentials: 'include', headers: getCsrfHeaders(),
        body: JSON.stringify({ title: title.trim(), visibility: visibility.toLowerCase() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({} as any))).error || `Create failed (${res.status})`);
      const j = await res.json();
      const col: CollectionRow = j.collection ?? j.item ?? j;
      setTitle('');
      await loadCollections();
      if (alsoAdd && col?.slug) await addTo(col.slug);
      else { setMode('choose'); setMsg('Collection created'); }
    } catch (e: any) { setMsg(e.message || 'Error creating collection'); }
    finally { setBusy(false); }
  }

  async function addTo(slug: string) {
    if (!slug) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/collections/${encodeURIComponent(slug)}/entries`, {
        method: 'POST', credentials: 'include', headers: getCsrfHeaders(), body: JSON.stringify({ postId }),
      });
      if (res.status === 409) { setMsg('Already in this collection'); setTimeout(() => setMsg(null), 1200); return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({} as any))).error || `Add failed (${res.status})`);
      setMsg('Added!'); setTimeout(() => { setMsg(null); onClose(); }, 700);
    } catch (e: any) { setMsg(e.message || 'Error adding'); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button className="underline text-xs" onClick={onOpen}>Add to Collection...</button>
      {!open ? null : (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-3" onClick={onClose}>
          <div className="panel max-w-[520px] w-full mt-16 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Add to Collection</h3>
              <button className="text-xs underline" onClick={onClose}>Close</button>
            </div>

            {loading ? (
              <div className="text-sm text-[color:var(--ink-600)]">Loading…</div>
            ) : mode === 'choose' && collections.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[13px] text-[color:var(--ink-700)]">
                  Choose a collection, or <button className="underline" onClick={() => setMode('create')}>create a new one</button>.
                </p>
                <div className="max-h-56 overflow-auto rounded border">
                  <ul className="divide-y">
                    {collections.map((c) => (
                      <li key={c.slug} className="flex items-center gap-3 p-2">
                        <input type="radio" name="collection" className="accent-[color:var(--brand-teal)]"
                               checked={selectedSlug === c.slug} onChange={() => setSelectedSlug(c.slug)} />
                        <div className="flex-1">
                          <div className="font-medium">{c.title}</div>
                          <div className="text-[11px] text-[color:var(--ink-600)]">
                            {c.visibility === 'PUBLIC' ? 'Public' : 'Private'} · {c._count?.entries ?? 0} items
                          </div>
                        </div>
                        <a className="underline text-[11px]" href={`/c/${encodeURIComponent(c.slug)}`} target="_blank">Open</a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button className="pill" onClick={onClose}>Cancel</button>
                  <button className="pill-primary" disabled={!selectedSlug || busy}
                          onClick={() => selectedSlug && addTo(selectedSlug)}>
                    {busy ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-[color:var(--ink-700)]">
                  {collections.length === 0
                    ? `You don't have any collections yet. Create one now and we'll add this post to it.`
                    : <>Create a new collection.</>}
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-medium">Title</label>
                  <input className="input" placeholder="e.g. Favorite Recipes" value={title}
                         onChange={(e) => setTitle(e.target.value)} maxLength={128} />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium">Visibility</label>
                  <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
                    <option value="PUBLIC">Public (anyone can see)</option>
                    <option value="PRIVATE">Private (only you)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  {collections.length > 0 ? (
                    <button className="text-xs underline" onClick={() => setMode('choose')}>Back to list</button>
                  ) : <span />}
                  <div className="flex items-center gap-2">
                    <button className="pill" onClick={onClose}>Cancel</button>
                    <button className="pill" disabled={busy} onClick={() => createAndMaybeAdd(false)}>
                      {busy ? 'Working…' : 'Create'}
                    </button>
                    <button className="pill-primary" disabled={busy} onClick={() => createAndMaybeAdd(true)}>
                      {busy ? 'Working…' : 'Create & Add'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {msg && <div className="mt-2 text-[12px] text-[color:var(--ink-700)]">{msg}</div>}
          </div>
        </div>
      )}
    </>
  );
}
