import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import SpaceSettingsForm, { type SpaceSettingsConfig } from './SpaceSettingsForm';

const LAYOUT_BLOCKS = ['about', 'links', 'members', 'gallery', 'pinned', 'rules'] as const;
type LayoutBlock = (typeof LAYOUT_BLOCKS)[number];
type SpaceVisibility = 'PUBLIC' | 'INVITE';

type SpaceRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdById: string;
  settings: unknown;
  visibility: unknown;
};

type LoadedSpace = {
  space: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
  };
  config: SpaceSettingsConfig;
};

const DEFAULT_CONFIG: SpaceSettingsConfig = {
  theme: { accent: '#2F7A7B', bannerUrl: '', backgroundUrl: '' },
  layout: ['about', 'links', 'members'],
  links: [],
  visibility: 'PUBLIC',
  rulesText: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseTheme(theme: unknown): SpaceSettingsConfig['theme'] {
  if (!isRecord(theme)) {
    return { ...DEFAULT_CONFIG.theme };
  }

  const accent = typeof theme.accent === 'string' ? theme.accent : DEFAULT_CONFIG.theme.accent;
  const bannerUrl = typeof theme.bannerUrl === 'string' ? theme.bannerUrl : '';
  const backgroundUrl = typeof theme.backgroundUrl === 'string' ? theme.backgroundUrl : '';

  return { accent, bannerUrl, backgroundUrl };
}

function parseLayout(layout: unknown): LayoutBlock[] {
  if (!Array.isArray(layout)) {
    return [...DEFAULT_CONFIG.layout];
  }

  const result: LayoutBlock[] = [];
  for (const item of layout) {
    if (typeof item !== 'string') continue;
    if (!LAYOUT_BLOCKS.includes(item as LayoutBlock)) continue;
    if (result.includes(item as LayoutBlock)) continue;
    result.push(item as LayoutBlock);
    if (result.length === 8) break;
  }

  return result.length ? result : [...DEFAULT_CONFIG.layout];
}

function parseLinks(links: unknown): SpaceSettingsConfig['links'] {
  if (!Array.isArray(links)) {
    return [];
  }

  const result: SpaceSettingsConfig['links'] = [];
  for (const item of links) {
    if (!isRecord(item)) continue;
    const label = typeof item.label === 'string' ? item.label : '';
    const url = typeof item.url === 'string' ? item.url : '';
    if (!label || !url) continue;
    result.push({ label, url });
    if (result.length === 10) break;
  }

  return result;
}

function parseRulesText(rulesText: unknown): string {
  if (typeof rulesText !== 'string') {
    return '';
  }

  return rulesText.length > 2000 ? rulesText.slice(0, 2000) : rulesText;
}

function parseVisibility(visibility: unknown): SpaceVisibility {
  return visibility === 'INVITE' || visibility === 'PUBLIC' ? visibility : DEFAULT_CONFIG.visibility;
}

async function ensureCanManage(space: SpaceRecord): Promise<void> {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    notFound();
  }

  if (space.createdById === profileId) {
    return;
  }

  const membership = await prisma.spaceMembership.findUnique({
    where: { spaceId_profileId: { spaceId: space.id, profileId } },
    select: { role: true },
  });

  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MODERATOR')) {
    notFound();
  }
}

async function loadSpace(slug: string): Promise<LoadedSpace> {
  const record = (await prisma.space.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      createdById: true,
      settings: true,
      visibility: true,
    },
  })) as SpaceRecord | null;

  if (!record) {
    notFound();
  }

  await ensureCanManage(record);

  const settings: Record<string, unknown> = isRecord(record.settings) ? record.settings : {};
  const config: SpaceSettingsConfig = {
    theme: parseTheme(settings.theme),
    layout: parseLayout(settings.layout),
    links: parseLinks(settings.links),
    visibility: parseVisibility(record.visibility),
    rulesText: parseRulesText(settings.rulesText),
  };

  return {
    space: {
      id: record.id,
      slug: record.slug,
      name: record.name,
      description: record.description,
    },
    config,
  };
}

export default async function SpaceSettingsPage({ params }: { params: { slug: string } }) {
  const { space, config } = await loadSpace(params.slug);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Space Settings — {space.name}</h1>
      <p className="mb-6 text-sm text-gray-500">Customize your space and manage invites &amp; members.</p>
      <SpaceSettingsForm slug={space.slug} initialConfig={config} />
    </main>
  );
}
