// File: src/app/p/[id]/metadata.ts
import type { Metadata } from 'next';

import { prisma } from '@/lib/db';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: {
      body: true,
      state: true,
      visibility: true,
      media: { include: { media: { include: { variants: true } } } },
      createdAt: true,
    },
  });

  if (!post || post.state !== 'ACTIVE' || post.visibility !== 'PUBLIC') {
    return { title: 'Post | alinkah' };
  }

  const text = (post.body ?? '').slice(0, 80);
  const firstVariantKey = post.media[0]?.media?.variants?.[0]?.key;
  const base = process.env.S3_PUBLIC_BASE_URL ?? '';
  const ogImage = firstVariantKey ? (base ? `${base}/${firstVariantKey}` : firstVariantKey) : undefined;

  return {
    title: text ? `${text} — alinkah` : 'alinkah post',
    description: text,
    openGraph: {
      title: text || 'alinkah post',
      description: text,
      images: ogImage ? [{ url: ogImage }] : [],
      type: 'article',
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: text || 'alinkah post',
      description: text,
      images: ogImage ? [ogImage] : [],
    },
  } satisfies Metadata;
}
