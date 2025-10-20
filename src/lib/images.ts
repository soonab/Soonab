// src/lib/images.ts
import sharp from 'sharp';

export const allowedTypes = (process.env.ALLOWED_IMAGE_TYPES ?? 'image/jpeg,image/png,image/webp')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

export function extFromType(type: string) {
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'bin';
}

export async function sanitizeAndVariants(input: Buffer) {
  const base = sharp(input, { failOn: 'none' }).rotate();
  const meta = await base.metadata();

  const original = await base
    .clone()
    .toFormat(meta.format === 'png' ? 'png' : 'jpeg', { quality: 90 })
    .toBuffer();

  const large = await sharp(original)
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .toFormat('webp', { quality: 88 })
    .toBuffer();

  const thumb = await sharp(original)
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .toFormat('webp', { quality: 80 })
    .toBuffer();

  const originalInfo = await sharp(original).metadata();
  const largeInfo = await sharp(large).metadata();
  const thumbInfo = await sharp(thumb).metadata();

  return {
    original: {
      buf: original,
      w: originalInfo.width ?? 0,
      h: originalInfo.height ?? 0,
      ct: originalInfo.format === 'png' ? 'image/png' : 'image/jpeg',
    },
    large: {
      buf: large,
      w: largeInfo.width ?? 0,
      h: largeInfo.height ?? 0,
      ct: 'image/webp',
    },
    thumb: {
      buf: thumb,
      w: thumbInfo.width ?? 0,
      h: thumbInfo.height ?? 0,
      ct: 'image/webp',
    },
  };
}
