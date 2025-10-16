// src/lib/security.ts
import type { NextRequest } from 'next/server';

export function siteOrigin(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL(base).origin;
}

export function assertSameOrigin(req: NextRequest) {
  const allowed = siteOrigin();
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).origin !== allowed) {
    // Block cross-origin browser posts (CSRF posture)
    const err = new Error('bad_origin') as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

export async function requireJson<T = any>(req: NextRequest): Promise<T> {
  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    const err = new Error('bad_content_type') as Error & { status?: number };
    err.status = 415;
    throw err;
  }
  try {
    return (await req.json()) as T;
  } catch {
    const err = new Error('invalid_json') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
}

export function clientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  const xr = req.headers.get('x-real-ip');
  if (xr) return xr.trim();
  return 'local';
}
