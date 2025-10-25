'use client';

const BLOCKS = ['about', 'links', 'members', 'gallery', 'pinned'] as const;
type LayoutBlock = (typeof BLOCKS)[number];

type Space = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
};

type Config = {
  theme: { accent: string; bannerUrl?: string; backgroundUrl?: string };
  layout: LayoutBlock[];
  links: { label: string; url: string }[];
  visibility: 'PUBLIC' | 'INVITE';
};

type SpaceBlocksProps = {
  space: Space;
  config: Config;
};

const linkTextClass = 'underline decoration-gray-400 decoration-1 underline-offset-2 transition hover:decoration-current';

export default function SpaceBlocks({ space, config }: SpaceBlocksProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {config.layout.map((block) => {
        if (block === 'about') {
          return (
            <div key="about" className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-gray-900">About</h3>
              <p className="text-sm text-gray-700">{space.description || 'No description yet.'}</p>
            </div>
          );
        }

        if (block === 'links') {
          return (
            <div key="links" className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-gray-900">Links</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
                {config.links.length > 0 ? (
                  config.links.map((link, index) => (
                    <li key={`${link.url}-${index}`}>
                      <a className={linkTextClass} href={link.url} target="_blank" rel="noreferrer">
                        {link.label || link.url}
                      </a>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500">No links yet.</li>
                )}
              </ul>
            </div>
          );
        }

        if (block === 'members') {
          return (
            <div key="members" className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-gray-900">Members</h3>
              <p className="text-sm text-gray-600">Member list card coming later; manage in Settings for now.</p>
            </div>
          );
        }

        if (block === 'gallery') {
          return (
            <div key="gallery" className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-gray-900">Latest activity</h3>
              <p className="text-sm text-gray-600">Your Space’s feed appears below — newest first.</p>
            </div>
          );
        }

        if (block === 'pinned') {
          return (
            <div key="pinned" className="rounded border border-gray-200 bg-white p-4">
              <h3 className="mb-2 font-medium text-gray-900">Pinned</h3>
              <p className="text-sm text-gray-600">Pinned content area (future bite).</p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
