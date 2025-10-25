'use client';

import * as React from 'react';

import JoinSpaceButton from '@/components/space/JoinSpaceButton';

type SuggestedSpace = {
  slug: string;
  name: string;
  reason?: string;
};

type SuggestedSpacesResponse = {
  suggestions?: SuggestedSpace[];
};

export default function DiscoverSpacesCard(): React.ReactElement | null {
  const [items, setItems] = React.useState<SuggestedSpace[] | null>(null);

  React.useEffect(() => {
    let active = true;

    const fetchSuggestions = async () => {
      try {
        const response = await fetch('/api/spaces/suggested?limit=5', {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!active) {
          return;
        }

        if (!response.ok) {
          setItems([]);
          return;
        }

        const data = (await response.json()) as SuggestedSpacesResponse;
        setItems(data.suggestions ?? []);
      } catch {
        if (active) {
          setItems([]);
        }
      }
    };

    void fetchSuggestions();

    return () => {
      active = false;
    };
  }, []);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <aside className="rounded border bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold">Discover Spaces</h3>
      <ul className="space-y-3">
        {items.map((space) => (
          <li key={space.slug} className="flex items-start justify-between gap-3">
            <div>
              <a className="font-medium hover:underline" href={`/space/${space.slug}`}>
                {space.name}
              </a>
              <div className="text-xs text-gray-500">{space.reason ?? 'Suggested for you'}</div>
            </div>
            <JoinSpaceButton slug={space.slug} />
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <a className="text-sm underline" href="/discover/spaces">
          See more
        </a>
      </div>
    </aside>
  );
}
