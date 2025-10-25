import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z, type infer as zInfer } from '@/lib/zod';

const db = prisma as any;

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;
const HTTP_URL_REGEX = /^https?:\/\/[^\s]+$/i;
const BLOCK_VALUES = ['about', 'links', 'members', 'gallery', 'pinned'] as const;
const SPACE_VISIBILITY_VALUES = ['PUBLIC', 'INVITE'] as const;

type Block = (typeof BLOCK_VALUES)[number];
type SpaceVisibility = (typeof SPACE_VISIBILITY_VALUES)[number];

type Theme = {
  accent: string;
  bannerUrl: string;
  backgroundUrl: string;
};

type Link = { label: string; url: string };

type SpaceConfig = {
  theme: Theme;
  layout: Block[];
  links: Link[];
  visibility: SpaceVisibility;
};

type RawSpaceSettings = Record<string, unknown>;
type PersistedSpaceSettings = {
  theme: Theme;
  layout: Block[];
  links: Link[];
};

const UrlFieldSchema = z
  .string()
  .refine((value) => value === '' || HTTP_URL_REGEX.test(value), 'Invalid URL')
  .optional();

const ThemeSchema = z.object({
  accent: z.string().regex(HEX_COLOR_REGEX),
  bannerUrl: UrlFieldSchema,
  backgroundUrl: UrlFieldSchema,
});

const BlockSchema = z.enum(BLOCK_VALUES);

const LinkSchema = z.object({
  label: z.string().min(1).max(40),
  url: z.string().refine((value) => HTTP_URL_REGEX.test(value), 'Invalid URL'),
});

const SpaceConfigSchema = z.object({
  theme: ThemeSchema,
  layout: z.array(BlockSchema).max(8),
  links: z.array(LinkSchema).max(10).optional(),
  visibility: z.enum(SPACE_VISIBILITY_VALUES),
});

type ThemeInput = zInfer<typeof ThemeSchema>;

const DEFAULT_CONFIG: SpaceConfig = {
  theme: { accent: '#2F7A7B', bannerUrl: '', backgroundUrl: '' },
  layout: ['about', 'links', 'members'],
  links: [],
  visibility: 'PUBLIC',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTheme(value: unknown): Theme {
  if (!isRecord(value)) return { ...DEFAULT_CONFIG.theme };
  const parsed = ThemeSchema.safeParse(value);
  if (!parsed.success) return { ...DEFAULT_CONFIG.theme };
  return {
    accent: parsed.data.accent,
    bannerUrl: parsed.data.bannerUrl ?? '',
    backgroundUrl: parsed.data.backgroundUrl ?? '',
  };
}

function normalizeLayout(value: unknown): Block[] {
  if (!Array.isArray(value)) return [...DEFAULT_CONFIG.layout];
  const deduped: Block[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    if (!BLOCK_VALUES.includes(item as Block)) continue;
    if (deduped.includes(item as Block)) continue;
    deduped.push(item as Block);
    if (deduped.length === 8) break;
  }
  return deduped.length ? deduped : [...DEFAULT_CONFIG.layout];
}

function normalizeLinks(value: unknown): Link[] {
  if (!Array.isArray(value)) return [];
  const links: Link[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const parsed = LinkSchema.safeParse(item);
    if (parsed.success) {
      links.push(parsed.data);
      if (links.length === 10) break;
    }
  }
  return links;
}

function normalizeVisibility(value: unknown): SpaceVisibility {
  return SPACE_VISIBILITY_VALUES.includes(value as SpaceVisibility)
    ? (value as SpaceVisibility)
    : DEFAULT_CONFIG.visibility;
}

function mergeConfig(settings: RawSpaceSettings, visibility: SpaceVisibility): SpaceConfig {
  return {
    theme: normalizeTheme(settings.theme),
    layout: normalizeLayout(settings.layout),
    links: normalizeLinks(settings.links),
    visibility,
  };
}

async function loadSpaceBySlug(slug: string) {
  return db.space.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, description: true },
  }) as Promise<{ id: string; slug: string; name: string; description: string | null } | null>;
}

async function getSettingsAndVisibility(spaceId: string) {
  const result = await db.space.findUnique({
    where: { id: spaceId },
    select: { settings: true, visibility: true },
  }) as { settings?: unknown; visibility?: unknown } | null;

  const settings = isRecord(result?.settings) ? (result?.settings as RawSpaceSettings) : {};
  const visibility = normalizeVisibility(result?.visibility);

  return { settings, visibility };
}

async function roleFor(profileId: string | null, spaceId: string) {
  if (!profileId) return null;

  const membership = await db.spaceMembership.findUnique({
    where: { spaceId_profileId: { spaceId, profileId } },
    select: { role: true },
  }) as { role?: string } | null;

  return typeof membership?.role === 'string' ? membership.role : null;
}

function normalizeThemeInput(theme: ThemeInput): Theme {
  return {
    accent: theme.accent,
    bannerUrl: theme.bannerUrl ?? '',
    backgroundUrl: theme.backgroundUrl ?? '',
  };
}

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const space = await loadSpaceBySlug(ctx.params.slug);
  if (!space) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { settings, visibility } = await getSettingsAndVisibility(space.id);
  const config = mergeConfig(settings, visibility);

  return NextResponse.json({ space, config });
}

export async function PUT(req: NextRequest, ctx: { params: { slug: string } }) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const input = await requireJson(req, SpaceConfigSchema);
  if (!input.layout.length) {
    return NextResponse.json({ error: 'Invalid layout' }, { status: 400 });
  }

  const space = await loadSpaceBySlug(ctx.params.slug);
  if (!space) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const profileId = await getCurrentProfileId();
  const role = await roleFor(profileId, space.id);
  if (role !== 'OWNER' && role !== 'MODERATOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const settings: PersistedSpaceSettings = {
    theme: normalizeThemeInput(input.theme),
    layout: input.layout,
    links: input.links ?? [],
  };

  await db.space.update({
    where: { id: space.id },
    data: {
      settings,
      visibility: input.visibility,
    },
  });

  return NextResponse.json({ ok: true });
}
