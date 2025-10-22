'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Visibility } from '@prisma/client';
import { apiFetch } from '@/lib/csrf-client';
import { VisibilitySelect } from './VisibilitySelect';

type LinkRow = { id?: string; title: string; url: string; order: number; visibility: Visibility };
type Loaded = {
  id: string; handle: string;
  bio: string | null; bioVisibility: Visibility;
  location: string | null; locationVisibility: Visibility;
  links: LinkRow[];
};

export default function ProfileEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [bio, setBio] = useState('');
  const [bioV, setBioV] = useState<Visibility>('PUBLIC');

  const [location, setLocation] = useState('');
  const [locV, setLocV] = useState<Visibility>('PUBLIC');

  const [links, setLinks] = useState<LinkRow[]>([]);
  const canAddLink = useMemo(() => links.length < 5, [links.length]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch('/api/account/profile', { credentials: 'same-origin' });
        const j = await r.json();
        if (!live) return;
        if (!j.ok) throw new Error(j.error || 'Load failed');
        const p = j.profile as Loaded;
        setBio(p.bio ?? '');
        setBioV(p.bioVisibility);
        setLocation(p.location ?? '');
        setLocV(p.locationVisibility);
        setLinks(p.links || []);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || 'Load failed');
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const payload = {
        bio: bio.trim() || null,
        bioVisibility: bioV,
        location: location.trim() || null,
        locationVisibility: locV,
        links: links.map((l, i) => ({
          id: l.id,
          title: l.title.trim(),
          url: l.url.trim(),
          order: i,
          visibility: l.visibility,
        })),
      };
      const res = await apiFetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error || `Save failed (${res.status})`);
      setOk('Saved');
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded border p-4 text-sm text-gray-500">Loading profile…</div>;

  return (
    <div className="space-y-6">
      <section className="rounded border p-4 bg-white">
        <h2 className="font-semibold mb-3">About</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <label className="text-xs text-gray-600">Short bio (max 200)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              className="mt-1 w-full rounded border p-2"
              placeholder="A sentence about you — interests, work, etc."
            />
          </div>
          <div className="mt-2 md:mt-0">
            <label className="text-xs text-gray-600">Visibility</label>
            <div className="mt-1">
              <VisibilitySelect id="bioV" value={bioV} onChange={setBioV} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <label className="text-xs text-gray-600">Location (max 80)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded border p-2"
              placeholder="City, Country"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Visibility</label>
            <div className="mt-1">
              <VisibilitySelect id="locV" value={locV} onChange={setLocV} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded border p-4 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Links</h2>
          <button
            type="button"
            className="btn"
            disabled={!canAddLink}
            onClick={() =>
              setLinks((prev) => [
                ...prev,
                { title: '', url: '', order: prev.length, visibility: 'PUBLIC' },
              ])
            }
          >
            Add link
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {links.length === 0 && <p className="text-sm text-gray-500">No links added yet.</p>}
          {links.map((l, i) => (
            <div key={l.id ?? `new-${i}`} className="rounded border p-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <div>
                  <label className="text-xs text-gray-600">Title</label>
                  <input
                    value={l.title}
                    onChange={(e) =>
                      setLinks((prev) =>
                        prev.map((it, ix) => (ix === i ? { ...it, title: e.target.value } : it)),
                      )
                    }
                    maxLength={30}
                    className="mt-1 w-full rounded border p-2"
                    placeholder="Personal site, LinkedIn, GitHub…"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">URL</label>
                  <input
                    value={l.url}
                    onChange={(e) =>
                      setLinks((prev) =>
                        prev.map((it, ix) => (ix === i ? { ...it, url: e.target.value } : it)),
                      )
                    }
                    className="mt-1 w-full rounded border p-2"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Visibility</label>
                  <div className="mt-1">
                    <VisibilitySelect
                      id={`linkV-${i}`}
                      value={l.visibility}
                      onChange={(v) =>
                        setLinks((prev) =>
                          prev.map((it, ix) => (ix === i ? { ...it, visibility: v } : it)),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    setLinks((prev) =>
                      prev.filter((_, ix) => ix !== i).map((it, ix) => ({ ...it, order: ix })),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border p-4 bg-white">
        <h2 className="font-semibold mb-2">Organization verification</h2>
        <OrgVerifyWidget />
      </section>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {ok && <span className="text-xs text-green-700">{ok}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function OrgVerifyWidget() {
  const [status, setStatus] = useState<any | null>(null);
  const [orgName, setOrgName] = useState('');
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/account/verify/org', { credentials: 'same-origin' });
      const j = await r.json();
      if (j.ok) setStatus(j.verification);
    })();
  }, []);

  async function request() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch('/api/account/verify/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName.trim(),
          domain: domain.trim().toLowerCase(),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error || 'Request failed');
      setStatus(j.verification);
      setMsg('Requested. If your sign-in email matches the domain, it will verify automatically in dev.');
    } catch (e: any) {
      setMsg(e?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {status ? (
        <p className="text-sm">
          Status: <b>{status.status}</b>
          {status.status === 'VERIFIED' && status.orgName ? (
            <>
              {' '}
              — <span className="text-green-700">{status.orgName}</span> ({status.domain})
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-gray-500">No verification request yet.</p>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Org name"
          className="rounded border p-2"
        />
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="rounded border p-2"
        />
        <button type="button" className="btn" onClick={request} disabled={busy || !orgName || !domain}>
          {busy ? 'Requesting…' : 'Request verify'}
        </button>
      </div>
      {msg && <p className="text-xs text-gray-600">{msg}</p>}
    </div>
  );
}
