'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/csrf-client';

type Props = { existingSlug: string | null };

type CreatePersonalSpaceResponse = {
  slug?: string;
  error?: string;
};

export default function PersonalSpaceTile({ existingSlug }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState<string | null>(existingSlug);

  async function createPersonalSpace() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch('/api/account/personal-space', {
        method: 'POST',
      });
      const data = (await res
        .json()
        .catch(() => null)) as CreatePersonalSpaceResponse | null;
      if (!res.ok || !data?.slug) {
        setMsg(data?.error || 'Could not create your Personal Space.');
      } else {
        setSlug(data.slug);
        router.push(`/space/${data.slug}/settings`);
        return;
      }
    } catch {
      setMsg('Network error creating your Personal Space.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border p-4 shadow-sm">
      <h2 className="mb-1 text-base font-semibold">Personal Space</h2>
      <p className="mb-4 text-sm text-gray-600">
        Create a personal page for your posts, theme it, and invite friends.
      </p>
      {!slug ? (
        <button className="btn" onClick={createPersonalSpace} disabled={busy}>
          {busy ? 'Creating…' : 'Create Personal Space'}
        </button>
      ) : (
        <div className="flex gap-2">
          <a className="btn" href={`/space/${slug}`}>
            Go to Personal Space
          </a>
          <a className="btn btn-ghost" href={`/space/${slug}/settings`}>
            Manage Members &amp; Settings
          </a>
        </div>
      )}
      {msg && <p className="mt-3 text-xs text-red-600">{msg}</p>}
    </section>
  );
}
