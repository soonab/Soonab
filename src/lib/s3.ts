// src/lib/s3.ts
import { S3Client } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;

function need(one: string, alt?: string) {
  const v = process.env[one] ?? (alt ? process.env[alt] : undefined);
  if (!v) throw new Error(`[s3] Missing env: ${one}${alt ? ` (or ${alt})` : ''}`);
  return v;
}
function opt(one: string, alt?: string) {
  return process.env[one] ?? (alt ? process.env[alt] : undefined);
}

export function getBucketName() {
  // Accept both names; prefer S3_BUCKET if present
  // If neither is present and NEXT_PUBLIC_S3_PUBLIC_BASE is set, we won't need a bucket here.
  return process.env.S3_BUCKET ?? process.env.AWS_S3_BUCKET;
}

export function getRegion() {
  // Default to us-east-1 if nothing set (AWS default for many buckets)
  return process.env.S3_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
}

export function getKeyPrefix() {
  // If you want "uploads", set S3_KEY_PREFIX=uploads in .env
  return process.env.S3_KEY_PREFIX ?? 'public';
}

export function getS3Client() {
  if (_client) return _client;
  const region = getRegion();
  const accessKeyId = opt('AWS_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID');
  const secretAccessKey = opt('AWS_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY');

  _client = new S3Client({
    region,
    // Locally you typically use explicit creds; on Vercel/EC2 you might rely on role
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
  return _client;
}

/**
 * Resolve the public base URL used by the browser to fetch images.
 * Priority:
 *  1) NEXT_PUBLIC_S3_PUBLIC_BASE (works client + server)
 *  2) Construct from S3 bucket + region
 * Errors loudly if neither is available, to avoid accidental "/public/..." paths.
 */
export function getPublicBase() {
  const explicit = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE || process.env.S3_PUBLIC_BASE;
  if (explicit) {
    // Ensure absolute https URL and a single trailing slash
    if (!/^https?:\/\//i.test(explicit)) {
      throw new Error(
        `[s3] NEXT_PUBLIC_S3_PUBLIC_BASE must be an absolute http(s) URL, got "${explicit}"`
      );
    }
    return explicit.replace(/\/+$/, '') + '/';
  }

  const bucket = getBucketName();
  const region = getRegion();

  if (bucket) {
    // Region-specific virtual-hosted–style endpoint
    return `https://${bucket}.s3.${region}.amazonaws.com/`;
  }

  // Nothing configured → fail loudly in dev, so we don't render local-looking paths
  throw new Error(
    '[s3] No public base configured. Set NEXT_PUBLIC_S3_PUBLIC_BASE (preferred) or S3_BUCKET/AWS_S3_BUCKET + S3_REGION/AWS_REGION.'
  );
}

export function publicUrlForKey(key: string) {
  const base = getPublicBase();
  // normalize: strip any leading slash from key
  return base + String(key || '').replace(/^\/+/, '');
}
