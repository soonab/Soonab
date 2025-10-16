// src/lib/ratelimit.ts
import type { NextRequest } from 'next/server';
import { clientIp } from '@/lib/security';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function windowMs(sec: number) { return sec * 1000; }
export function rateLimitKey(base: string, ip: string) { return `${base}:${ip}`; }

export function rateLimit(
  name: string,
  ip: string,
  limit = 5,
  windowSec = 60
): { ok: boolean; retryAfter?: number } {
  const key = rateLimitKey(name, ip);
  const now = Date.now();
  const win = windowMs(windowSec);
  const b = buckets.get(key);

  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + win });
    return { ok: true };
  }
  if (b.count < limit) {
    b.count += 1;
    return { ok: true };
  }
  const retryAfter = Math.max(0, Math.ceil((b.resetAt - now) / 1000));
  return { ok: false, retryAfter };
}

export function limitRequest(req: NextRequest, name: string, limit: number, windowSec: number) {
  const ip = clientIp(req);
  return rateLimit(name, ip, limit, windowSec);
}
