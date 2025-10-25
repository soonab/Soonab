'use client';
import * as React from 'react';

type Space = { id: string; slug: string; name: string; description?: string | null };
type Config = {
  theme: { accent: string; bannerUrl?: string; backgroundUrl?: string };
  layout: ('about'|'links'|'members'|'gallery'|'pinned')[];
  links: { label: string; url: string }[];
  visibility: 'PUBLIC'|'INVITE';
};

export default function SpaceBlocks({ space, config }: { space: Space; config: Config }) {
  const [pinned, setPinned] = React.useState<{ postId:string; body:string; createdAt:string; position:number }[] | null>(null);

  React.useEffect(() => {
    if (!config.layout.includes('pinned')) return;
    (async () => {
      const j = await fetch(`/api/spaces/${space.slug}/pinned`).then(r=>r.json());
      setPinned((j.pinned || []).map((x: any) => ({ ...x, createdAt: x.createdAt })));
    })();
  }, [space.slug, config.layout]);

  const items = config.layout.map((b) => {
    if (b === 'about') {
      return (
        <div key="about" className="rounded border p-4">
          <h3 className="font-medium mb-2">About</h3>
          <p className="text-sm text-gray-700">{space.description || 'No description yet.'}</p>
        </div>
      );
    }
    if (b === 'links') {
      return (
        <div key="links" className="rounded border p-4">
          <h3 className="font-medium mb-2">Links</h3>
          <ul className="text-sm list-disc pl-5">
            {config.links.length ? config.links.map((l, i) => (
              <li key={i}><a className="underline" href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a></li>
            )) : <li className="text-gray-500">No links yet.</li>}
          </ul>
        </div>
      );
    }
    if (b === 'members') {
      return (
        <div key="members" className="rounded border p-4">
          <h3 className="font-medium mb-2">Members</h3>
          <p className="text-sm text-gray-600">Member list card coming later; manage in Settings for now.</p>
        </div>
      );
    }
    if (b === 'gallery') {
      return (
        <div key="gallery" className="rounded border p-4">
          <h3 className="font-medium mb-2">Latest activity</h3>
          <p className="text-sm text-gray-600">Your Space’s feed appears below — newest first.</p>
        </div>
      );
    }
    if (b === 'pinned') {
      return (
        <div key="pinned" className="rounded border p-4">
          <h3 className="font-medium mb-2">Pinned</h3>
          {!pinned ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : pinned.length === 0 ? (
            <p className="text-sm text-gray-500">No pinned posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {pinned.map((p) => (
                <li key={p.postId} className="rounded border p-3">
                  <p className="whitespace-pre-wrap text-sm">{p.body}</p>
                  <div className="text-xs text-gray-500 mt-1">{new Date(p.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    return null;
  });

  return <div className="grid gap-4 md:grid-cols-2">{items}</div>;
}
