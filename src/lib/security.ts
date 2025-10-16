// src/lib/security.ts
import type { NextRequest } from 'next/server';

/**
 * Assert same-origin requests for state-changing endpoints.
 * Throws 'bad_origin' if Origin host !== Host header.
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return; // SSR/fetches may omit Origin; allow
  try {
    const u = new URL(origin);
    if (u.host !== host) throw new Error('bad_origin');
  } catch {
    throw new Error('bad_origin');
  }
}

/**
 * Require JSON content-type and parse body to T.
 * Throws on wrong content-type or invalid JSON.
 */
export async function requireJson<T = unknown>(req: NextRequest): Promise<T> {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) throw new Error('bad_content_type');
  const data = await req.json().catch(() => null);
  if (data === null || data === undefined) throw new Error('invalid_json');
  return data as T;
}

/** Best-effort client IP extraction (works on Vercel/Proxies). */
export function clientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for');
  const first = xf?.split(',')[0]?.trim();
  if (first) return first;

  const xr = req.headers.get('x-real-ip')?.trim();
  if (xr) return xr;

  const ra = req.headers.get('x-remote-addr')?.trim();
  if (ra) return ra;

  return 'local';
}

/** Legacy re-export so old call sites keep working. */
export { limitRequest } from './ratelimit';
