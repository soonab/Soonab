import Image from 'next/image';
import type { ReactNode } from 'react';
import type { Prisma, SpaceVisibility } from '@prisma/client';

import SpaceBlocks from '@/components/space/SpaceBlocks';
import JoinSpaceButton from '@/components/space/JoinSpaceButton';
import { prisma } from '@/lib/db';

type Visibility = SpaceVisibility;
const BLOCKS = ['about', 'links', 'members', 'gallery', 'pinned'] as const;
type LayoutBlock = (typeof BLOCKS)[number];

type SpacePreview = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

type SpaceConfig = {
  theme: { accent: string; bannerUrl: string; backgroundUrl: string };
  layout: LayoutBlock[];
  links: { label: string; url: string }[];
  visibility: Visibility;
};

type SpaceSettings = {
  theme?: Partial<SpaceConfig['theme']>;
  layout?: LayoutBlock[];
  links?: { label?: string; url?: string }[];
};

const DEFAULT_CONFIG: SpaceConfig = {
  theme: { accent: '#2F7A7B', bannerUrl: '', backgroundUrl: '' },
  layout: ['about', 'links', 'members'],
  links: [],
  visibility: 'PUBLIC',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLayoutBlock(value: unknown): value is LayoutBlock {
  return typeof value === 'string' && BLOCKS.includes(value as LayoutBlock);
}

function isSettings(value: unknown): value is SpaceSettings {
  if (!isPlainObject(value)) return false;
  return true;
}

function parseSettings(settings: Prisma.JsonValue | null | undefined): SpaceSettings {
  if (!isSettings(settings)) return {};
  return settings;
}

function applySettings(settings: SpaceSettings, visibility: Visibility): SpaceConfig {
  const nextConfig: SpaceConfig = {
    ...DEFAULT_CONFIG,
    theme: { ...DEFAULT_CONFIG.theme },
    layout: [...DEFAULT_CONFIG.layout],
    links: [...DEFAULT_CONFIG.links],
    visibility,
  };

  if (settings.theme && isPlainObject(settings.theme)) {
    const { accent, bannerUrl, backgroundUrl } = settings.theme;
    nextConfig.theme = {
      accent: typeof accent === 'string' && accent.trim() ? accent : nextConfig.theme.accent,
      bannerUrl: typeof bannerUrl === 'string' ? bannerUrl : nextConfig.theme.bannerUrl,
      backgroundUrl: typeof backgroundUrl === 'string' ? backgroundUrl : nextConfig.theme.backgroundUrl,
    };
  }

  if (Array.isArray(settings.layout)) {
    const parsedLayout = settings.layout.filter(isLayoutBlock);
    if (parsedLayout.length > 0) {
      nextConfig.layout = parsedLayout;
    }
  }

  if (Array.isArray(settings.links)) {
    const parsedLinks = settings.links
      .filter(isPlainObject)
      .map((link) => {
        const label = typeof link.label === 'string' ? link.label : '';
        const url = typeof link.url === 'string' ? link.url : '';
        return { label, url };
      })
      .filter((link) => link.url.trim().length > 0);

    if (parsedLinks.length > 0) {
      nextConfig.links = parsedLinks.map((link) => ({
        label: link.label.trim().length > 0 ? link.label : link.url,
        url: link.url,
      }));
    }
  }

  return nextConfig;
}

async function getSpace(slug: string) {
  const record = await prisma.space.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      settings: true,
      visibility: true,
    },
  });

  if (!record) return null;

  const settings = parseSettings(record.settings);
  const config = applySettings(settings, record.visibility ?? DEFAULT_CONFIG.visibility);
  const space: SpacePreview = {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
  };

  return { space, config };
}

export default async function SpaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  const data = await getSpace(params.slug);

  if (!data) return <>{children}</>;

  const { space, config } = data;
  const accent = config.theme.accent;

  return (
    <div className="pb-10" style={config.theme.backgroundUrl ? { backgroundImage: `url(${config.theme.backgroundUrl})` } : undefined}>
      <header className="w-full">
        <div className="relative h-40 w-full overflow-hidden" style={{ backgroundColor: accent }}>
          {config.theme.bannerUrl ? (
            <Image
              src={config.theme.bannerUrl}
              alt={`${space.name} banner`}
              fill
              className="object-cover opacity-80"
              priority
            />
          ) : null}
        </div>
        <div className="mx-auto -mt-10 max-w-4xl px-4">
          <div className="rounded-md bg-white p-4 shadow">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-xl font-semibold text-gray-900">{space.name}</h1>
              <div className="flex items-center gap-3">
                {config.visibility === 'INVITE' ? (
                  <span className="rounded-full border px-2 py-1 text-xs text-gray-700">Friend Space — unlimited posts</span>
                ) : null}
                <JoinSpaceButton slug={space.slug} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-6 max-w-4xl px-4">
        <SpaceBlocks space={space} config={config} />
      </section>

      <div className="mx-auto mt-8 max-w-4xl px-4">{children}</div>
    </div>
  );
}
