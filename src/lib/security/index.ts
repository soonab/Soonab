// src/lib/security/index.ts
import { NextResponse, type NextRequest } from 'next/server';

/** JSON helper to build a 4xx response */
function deny(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Same‑origin guard for state‑changing requests.
 * - Browser requests: require Origin host === Host
 * - Origin‑less (Node/cURL): require CSRF header to match cookie
 * Returns NextResponse (403) on failure, otherwise undefined.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | undefined {
  const host = req.headers.get('host') || '';
  const origin = req.headers.get('origin');

  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host === host) return;
    } catch {/* fallthrough */}
    return deny(403, 'Same-origin required');
  }

  // No Origin → Node/cURL; must present valid CSRF to proceed
  const header = req.headers.get('x-csrf');
  const cookie = req.cookies.get('csrf')?.value;
  if (header && cookie && header === cookie) return;

  return deny(403, 'Same-origin required');
}

/**
 * CSRF double‑submit check.
 * Returns NextResponse (403) on failure, otherwise undefined.
 */
export function requireCsrf(req: NextRequest): NextResponse | undefined {
  const header = req.headers.get('x-csrf');
  const cookie = req.cookies.get('csrf')?.value;
  if (!header || !cookie || header !== cookie) {
    return deny(403, 'Invalid CSRF');
  }
  return;
}

/**
 * Parse JSON; optionally validate via a "zod‑like" schema (safeParse).
 * Avoids importing z types so TypeScript doesn’t complain.
 */
export async function requireJson<T = unknown>(
  req: NextRequest,
  schema?: {
    safeParse?: (
      data: unknown
    ) => { success: true; data: T } | { success: false; error: unknown }
  }
): Promise<T> {
  const ct = (req.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/json')) {
    throw deny(415, 'Invalid content-type');
  }
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw deny(400, 'Invalid JSON');
  }
  if (schema?.safeParse) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw deny(400, 'Invalid body');
    return parsed.data;
  }
  return data as T;
}

/** Best‑effort client IP for rate‑limits. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return (req as any).ip || '127.0.0.1';
}
