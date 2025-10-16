// src/lib/security/index.ts
import type { NextRequest } from 'next/server';

/** Enforce same-origin for state-changing requests. */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return;
  try {
    const u = new URL(origin);
    if (u.host !== host) throw new Error('bad_origin');
  } catch {
    throw new Error('bad_origin');
  }
}

/** Require JSON content-type and parse body. */
export async function requireJson<T = unknown>(req: NextRequest): Promise<T> {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) throw new Error('bad_content_type');
  const data = await req.json().catch(() => null);
  if (data === null || data === undefined) throw new Error('invalid_json');
  return data as T;
}

/** Extract client IP (works behind proxies). */
export function clientIp(req: NextRequest): string {
  const first = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (first) return first;
  const xr = req.headers.get('x-real-ip')?.trim();
  if (xr) return xr;
  const ra = req.headers.get('x-remote-addr')?.trim();
  if (ra) return ra;
  return 'local';
}

/** Re-export rate limiter so legacy imports keep working. */
export { limitRequest } from '../ratelimit';
