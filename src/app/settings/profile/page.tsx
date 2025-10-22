'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrgVerifyStatus, Visibility } from '@prisma/client';
import { VisibilitySelect } from '@/components/profile/VisibilitySelect';
import { apiFetch } from '@/lib/csrf-client';

const MAX_BIO = 200;
const MAX_LOCATION = 80;
const MAX_LINKS = 5;

type ProfileLink = {
  id: string;
  title: string;
  url: string;
  order: number;
  visibility: Visibility;
};

type ProfileResponse = {
  ok: boolean;
  error?: string;
  profile?: {
    id: string;
    handle: string;
    bio: string | null;
    bioVisibility: Visibility;
    location: string | null;
    locationVisibility: Visibility;
    links: ProfileLink[];
    orgVerifications: Array<{
      id: string;
      orgName: string;
      status: OrgVerifyStatus;
      verifiedAt: string | null;
    }>;
  };
};

type LinkState = {
  key: string;
  id?: string;
  title: string;
  url: string;
  visibility: Visibility;
};

type OrgInfo = {
  orgName: string;
  status: OrgVerifyStatus;
  verifiedAt: string | null;
};

function makeKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}`;
}

function createLinkState(link?: Partial<Omit<LinkState, 'key'>> & { id?: string }): LinkState {
  return {
    key: makeKey(link?.id ?? 'link'),
    id: link?.id,
    title: link?.title ?? '',
    url: link?.url ?? '',
    visibility: link?.visibility ?? 'PUBLIC',
  };
}

export default function ProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [bioVisibility, setBioVisibility] = useState<Visibility>('PUBLIC');
  const [location, setLocation] = useState('');
  const [locationVisibility, setLocationVisibility] = useState<Visibility>('PUBLIC');
  const [links, setLinks] = useState<LinkState[]>([]);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);

  const applyProfile = useCallback((profile: NonNullable<ProfileResponse['profile']>) => {
    setHandle(profile.handle);
    setBio(profile.bio ?? '');
    setBioVisibility(profile.bioVisibility);
    setLocation(profile.location ?? '');
    setLocationVisibility(profile.locationVisibility);
    const sortedLinks = [...profile.links].sort((a, b) => a.order - b.order);
    setLinks(sortedLinks.map(link => createLinkState(link)));
    const latestOrg = profile.orgVerifications?.[0];
    if (latestOrg) {
      setOrgInfo({ orgName: latestOrg.orgName, status: latestOrg.status, verifiedAt: latestOrg.verifiedAt });
    } else {
      setOrgInfo(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/account/profile', { credentials: 'same-origin' });
        if (!res.ok) {
          const message = res.status === 401 ? 'Sign in required.' : `Failed to load profile (${res.status}).`;
          if (!active) return;
          setError(message);
          setLoading(false);
          return;
        }

        const data: ProfileResponse = await res.json();
        if (!active) return;

        if (!data.ok || !data.profile) {
          setError(data.error || 'Failed to load profile.');
          setLoading(false);
          return;
        }

        applyProfile(data.profile);
        setSuccess(null);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError('Failed to load profile.');
        setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [applyProfile]);

  const canAddLink = links.length < MAX_LINKS;

  const addLink = () => {
    if (!canAddLink) return;
    setLinks(prev => [...prev, createLinkState()]);
  };

  const updateLink = (index: number, changes: Partial<Omit<LinkState, 'key'>>) => {
    setLinks(prev => prev.map((link, idx) => (idx === index ? { ...link, ...changes } : link)));
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, idx) => idx !== index));
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedBio = bio.trim();
    const trimmedLocation = location.trim();

    const preparedLinks = links.map((link, index) => ({
      id: link.id,
      title: link.title.trim(),
      url: link.url.trim(),
      order: index,
      visibility: link.visibility,
    }));

    for (const [index, link] of preparedLinks.entries()) {
      if (!link.title) {
        setError(`Link ${index + 1} is missing a title.`);
        return;
      }
      if (!link.url) {
        setError(`Link ${index + 1} is missing a URL.`);
        return;
      }
    }

    const payload = {
      bio: trimmedBio ? trimmedBio : null,
      bioVisibility,
      location: trimmedLocation ? trimmedLocation : null,
      locationVisibility,
      links: preparedLinks,
    };

    setSaving(true);

    try {
      const res = await apiFetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data: ProfileResponse | null = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok || !data?.ok || !data.profile) {
        const message = data?.error || `Failed to save profile (${res.status}).`;
        setError(message);
        return;
      }

      setSuccess('Profile updated.');
      setError(null);
      applyProfile(data.profile);
    } catch (err) {
      setError('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Profile settings</h1>
        {handle && <p className="text-sm text-gray-600">Editing @{handle}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="bio" className="text-sm font-medium">Bio</label>
              <div className="flex items-center gap-2 text-xs">
                <span>Visibility</span>
                <VisibilitySelect id="bio-visibility" value={bioVisibility} onChange={v => setBioVisibility(v)} />
              </div>
            </div>
            <textarea
              id="bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              maxLength={MAX_BIO}
              className="w-full rounded border p-2 text-sm"
              placeholder="Tell people about yourself"
            />
            <p className="text-xs text-gray-500">{bio.length}/{MAX_BIO} characters</p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="location" className="text-sm font-medium">Location</label>
              <div className="flex items-center gap-2 text-xs">
                <span>Visibility</span>
                <VisibilitySelect id="location-visibility" value={locationVisibility} onChange={v => setLocationVisibility(v)} />
              </div>
            </div>
            <input
              id="location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              maxLength={MAX_LOCATION}
              className="w-full rounded border p-2 text-sm"
              placeholder="Where are you?"
            />
            <p className="text-xs text-gray-500">{location.length}/{MAX_LOCATION} characters</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Links</h2>
              <button
                type="button"
                onClick={addLink}
                disabled={!canAddLink}
                className="rounded border px-2 py-1 text-xs disabled:opacity-50"
              >
                Add link
              </button>
            </div>

            {links.length === 0 ? (
              <p className="text-xs text-gray-500">No links added yet.</p>
            ) : (
              <div className="space-y-3">
                {links.map((link, index) => (
                  <div key={link.key} className="rounded border p-3 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                      <label className="flex-1 text-xs font-medium">
                        <span className="mb-1 block text-xs font-medium text-gray-700">Title</span>
                        <input
                          value={link.title}
                          onChange={e => updateLink(index, { title: e.target.value })}
                          className="w-full rounded border px-2 py-1 text-sm"
                          placeholder="Website title"
                          maxLength={30}
                        />
                      </label>
                      <label className="flex-1 text-xs font-medium">
                        <span className="mb-1 block text-xs font-medium text-gray-700">URL</span>
                        <input
                          value={link.url}
                          onChange={e => updateLink(index, { url: e.target.value })}
                          className="w-full rounded border px-2 py-1 text-sm"
                          placeholder="https://example.com"
                          maxLength={200}
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span>Visibility</span>
                        <VisibilitySelect id={`link-${index}-visibility`} value={link.visibility} onChange={v => updateLink(index, { visibility: v })} />
                      </div>
                      <button type="button" onClick={() => removeLink(index)} className="text-red-600">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500">Up to {MAX_LINKS} links.</p>
          </section>

          {orgInfo && (
            <section className="space-y-1 rounded border bg-gray-50 p-3 text-xs text-gray-700">
              <span className="font-medium text-sm">Organization verification</span>
              <p>
                {orgInfo.status === 'VERIFIED' && orgInfo.verifiedAt
                  ? `Verified for ${orgInfo.orgName}.`
                  : orgInfo.status === 'PENDING'
                    ? `Verification request for ${orgInfo.orgName} is pending.`
                    : `Verification for ${orgInfo.orgName} is not active.`}
              </p>
            </section>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
