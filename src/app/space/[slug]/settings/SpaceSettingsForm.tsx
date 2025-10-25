'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/csrf-client';

const ALL_BLOCKS = ['about', 'links', 'members', 'gallery', 'pinned', 'rules'] as const;
type LayoutBlock = (typeof ALL_BLOCKS)[number];
export type SpaceSettingsConfig = {
  theme: { accent: string; bannerUrl: string; backgroundUrl: string };
  layout: LayoutBlock[];
  links: { label: string; url: string }[];
  visibility: 'PUBLIC' | 'INVITE';
  rulesText?: string;
};

type Member = {
  id: string;
  handle: string;
  name: string | null;
  role: 'OWNER' | 'MODERATOR' | 'MEMBER';
  isSelf: boolean;
  canRemove: boolean;
  invitedByYou: boolean;
};

type Invite = {
  id: string;
  tokenPreview: string;
  usesRemaining: number;
  expiresAt: string | null;
  link: string;
};

type Notice = { tone: 'success' | 'error'; text: string } | null;

type SpaceSettingsFormProps = {
  slug: string;
  initialConfig: SpaceSettingsConfig;
};

function isInvite(value: unknown): value is Invite {
  if (!value || typeof value !== 'object') return false;
  const invite = value as Record<string, unknown>;
  return (
    typeof invite.id === 'string' &&
    typeof invite.tokenPreview === 'string' &&
    typeof invite.link === 'string' &&
    typeof invite.usesRemaining === 'number' &&
    ('expiresAt' in invite ? invite.expiresAt === null || typeof invite.expiresAt === 'string' : true)
  );
}

function isMember(value: unknown): value is Member {
  if (!value || typeof value !== 'object') return false;
  const member = value as Record<string, unknown>;
  return (
    typeof member.id === 'string' &&
    typeof member.handle === 'string' &&
    ('name' in member ? member.name === null || typeof member.name === 'string' : true) &&
    (member.role === 'OWNER' || member.role === 'MODERATOR' || member.role === 'MEMBER') &&
    typeof member.isSelf === 'boolean' &&
    typeof member.canRemove === 'boolean' &&
    typeof member.invitedByYou === 'boolean'
  );
}

export default function SpaceSettingsForm({ slug, initialConfig }: SpaceSettingsFormProps) {
  const [cfg, setCfg] = React.useState<SpaceSettingsConfig>(initialConfig);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loadingInvites, setLoadingInvites] = React.useState(false);
  const [loadingMembers, setLoadingMembers] = React.useState(false);

  React.useEffect(() => {
    setCfg(initialConfig);
  }, [initialConfig]);

  const showSuccess = React.useCallback((text: string) => {
    setNotice({ tone: 'success', text });
  }, []);

  const showError = React.useCallback((text: string) => {
    setNotice({ tone: 'error', text });
  }, []);

  const loadInvites = React.useCallback(async () => {
    setLoadingInvites(true);
    try {
      const res = await fetch(`/api/spaces/${slug}/invites`, { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error('failed');
      }
      const data = (await res.json()) as { invites?: unknown };
      const items = Array.isArray(data.invites) ? data.invites.filter(isInvite) : [];
      setInvites(items);
    } catch (err) {
      console.error(err);
      showError('Could not load invites right now.');
    } finally {
      setLoadingInvites(false);
    }
  }, [showError, slug]);

  const loadMembers = React.useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/spaces/${slug}/members`, { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error('failed');
      }
      const data = (await res.json()) as { members?: unknown };
      const items = Array.isArray(data.members) ? data.members.filter(isMember) : [];
      setMembers(items);
    } catch (err) {
      console.error(err);
      showError('Could not load members right now.');
    } finally {
      setLoadingMembers(false);
    }
  }, [showError, slug]);

  React.useEffect(() => {
    void loadInvites();
    void loadMembers();
  }, [loadInvites, loadMembers]);

  const update = React.useCallback(<K extends keyof SpaceSettingsConfig>(key: K, value: SpaceSettingsConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSave = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!cfg.layout.length) {
        showError('Add at least one layout block before saving.');
        return;
      }

      setSaving(true);
      setNotice(null);

      try {
        const trimmedLinks = cfg.links
          .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
          .filter((link) => link.label && link.url);
        const payload: SpaceSettingsConfig = { ...cfg, links: trimmedLinks };
        const res = await apiFetch(`/api/spaces/${slug}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error('save-failed');
        }
        showSuccess('Changes saved.');
      } catch (err) {
        console.error(err);
        showError('Unable to save changes.');
      } finally {
        setSaving(false);
      }
    },
    [cfg, showError, showSuccess, slug],
  );

  const createInvite = React.useCallback(async () => {
    setNotice(null);
    try {
      const res = await apiFetch(`/api/spaces/${slug}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uses: 5, expiresInDays: 7 }),
      });
      if (!res.ok) {
        throw new Error('invite-failed');
      }
      showSuccess('Invite link created.');
      await loadInvites();
    } catch (err) {
      console.error(err);
      showError('Could not create invite link.');
    }
  }, [loadInvites, showError, showSuccess, slug]);

  const removeMember = React.useCallback(
    async (profileId: string) => {
      setNotice(null);
      try {
        const res = await apiFetch(`/api/spaces/${slug}/members/${profileId}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          throw new Error('remove-failed');
        }
        showSuccess('Member removed.');
        await loadMembers();
      } catch (err) {
        console.error(err);
        showError('Could not remove member.');
      }
    },
    [loadMembers, showError, showSuccess, slug],
  );

  const leaveSpace = React.useCallback(async () => {
    setNotice(null);
    try {
      const res = await apiFetch(`/api/spaces/${slug}/leave`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('leave-failed');
      }
      window.location.href = `/space/${slug}`;
    } catch (err) {
      console.error(err);
      showError('Could not leave the space.');
    }
  }, [showError, slug]);

  const accentLabelId = React.useId();
  const bannerLabelId = React.useId();
  const backgroundLabelId = React.useId();

  return (
    <form onSubmit={onSave} className="space-y-8">
      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Theme</h2>
        <div className="flex items-center gap-4">
          <label className="w-32 text-sm" htmlFor={accentLabelId}>
            Accent
          </label>
          <input
            id={accentLabelId}
            type="color"
            value={cfg.theme.accent}
            onChange={(event) => update('theme', { ...cfg.theme, accent: event.target.value })}
            className="h-9 w-14 cursor-pointer"
          />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="w-32 text-sm" htmlFor={bannerLabelId}>
            Banner URL
          </label>
          <input
            id={bannerLabelId}
            type="url"
            placeholder="https://…"
            value={cfg.theme.bannerUrl}
            onChange={(event) => update('theme', { ...cfg.theme, bannerUrl: event.target.value })}
            className="input input-bordered w-full max-w-lg"
          />
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="w-32 text-sm" htmlFor={backgroundLabelId}>
            Background URL
          </label>
          <input
            id={backgroundLabelId}
            type="url"
            placeholder="https://…"
            value={cfg.theme.backgroundUrl}
            onChange={(event) => update('theme', { ...cfg.theme, backgroundUrl: event.target.value })}
            className="input input-bordered w-full max-w-lg"
          />
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Layout blocks</h2>
        <ul className="space-y-2">
          {cfg.layout.map((block, index) => (
            <li key={block} className="flex items-center gap-3">
              <span className="w-32 text-sm capitalize">{block}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => {
                    if (index === 0) return;
                    const next = [...cfg.layout];
                    const current = next[index];
                    const previous = next[index - 1];
                    if (!current || !previous) return;
                    next[index] = previous;
                    next[index - 1] = current;
                    update('layout', next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => {
                    if (index === cfg.layout.length - 1) return;
                    const next = [...cfg.layout];
                    const current = next[index];
                    const following = next[index + 1];
                    if (!current || !following) return;
                    next[index] = following;
                    next[index + 1] = current;
                    update('layout', next);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  disabled={cfg.layout.length <= 1}
                  onClick={() => {
                    if (cfg.layout.length <= 1) return;
                    update('layout', cfg.layout.filter((value) => value !== block));
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_BLOCKS.filter((block) => !cfg.layout.includes(block)).map((block) => (
            <button
              key={block}
              type="button"
              className="btn btn-sm"
              onClick={() => update('layout', [...cfg.layout, block])}
            >
              Add {block}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="font-medium mb-3">Rules</h2>
        <textarea
          className="textarea textarea-bordered w-full min-h-28"
          placeholder="What’s expected in this Space…"
          value={cfg.rulesText || ''}
          onChange={(e) => setCfg((p) => ({ ...p, rulesText: e.target.value }))}
        />
        <p className="text-xs text-gray-500 mt-1">Max 2000 characters. Shown publicly when you add the Rules block.</p>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Links</h2>
        <div className="space-y-2">
          {cfg.links.map((link, index) => (
            <div key={`link-${index}`} className="flex gap-2">
              <input
                className="input input-bordered w-48"
                placeholder="Label"
                value={link.label}
                onChange={(event) => {
                  const next = [...cfg.links];
                  const current = next[index];
                  if (!current) return;
                  next[index] = { ...current, label: event.target.value };
                  update('links', next);
                }}
              />
              <input
                className="input input-bordered flex-1"
                placeholder="https://"
                value={link.url}
                onChange={(event) => {
                  const next = [...cfg.links];
                  const current = next[index];
                  if (!current) return;
                  next[index] = { ...current, url: event.target.value };
                  update('links', next);
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => update('links', cfg.links.filter((_, linkIndex) => linkIndex !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => update('links', [...cfg.links, { label: '', url: '' }])}
          >
            Add link
          </button>
        </div>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Visibility</h2>
        <label className="mr-4 inline-flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="space-visibility"
            checked={cfg.visibility === 'PUBLIC'}
            onChange={() => update('visibility', 'PUBLIC')}
          />
          <span>Public</span>
        </label>
        <label className="inline-flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="space-visibility"
            checked={cfg.visibility === 'INVITE'}
            onChange={() => update('visibility', 'INVITE')}
          />
          <span>Invite-only</span>
        </label>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Invites</h2>
        <div className="mb-3 flex gap-2">
          <button type="button" className="btn" onClick={createInvite}>
            Create invite link
          </button>
          <button type="button" className="btn btn-ghost" onClick={loadInvites}>
            {loadingInvites ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <ul className="text-sm">
          {invites.map((invite) => (
            <li key={invite.id} className="border-t py-2">
              <div className="flex items-center justify-between gap-4">
                <span>
                  {invite.tokenPreview} · uses left {invite.usesRemaining}
                  {invite.expiresAt ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(invite.link);
                    showSuccess('Invite link copied.');
                  }}
                >
                  Copy link
                </button>
              </div>
            </li>
          ))}
          {invites.length === 0 && <li className="text-gray-500">No invites yet.</li>}
        </ul>
      </section>

      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Members</h2>
        <button type="button" className="btn btn-ghost mb-3" onClick={loadMembers}>
          {loadingMembers ? 'Refreshing…' : 'Refresh'}
        </button>
        <ul className="text-sm">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 border-t py-2">
              <span>
                @{member.handle}
                {member.name ? ` · ${member.name}` : ''} · {member.role}
                {member.invitedByYou ? ' · invited by you' : ''}
                {member.isSelf ? ' · you' : ''}
              </span>
              <div className="flex gap-2">
                {member.isSelf ? (
                  <button type="button" className="btn btn-xs" onClick={leaveSpace}>
                    Leave
                  </button>
                ) : member.canRemove ? (
                  <button type="button" className="btn btn-xs" onClick={() => removeMember(member.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {members.length === 0 && <li className="text-gray-500">No members yet.</li>}
        </ul>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {notice && (
          <span className={`text-sm ${notice.tone === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {notice.text}
          </span>
        )}
      </div>
    </form>
  );
}
