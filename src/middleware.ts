// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

function normalizeOrigin(urlLike?: string | null) {
  if (!urlLike) return null;
  try {
    // Accept full URLs like https://bucket.s3.eu-north-1.amazonaws.com/foo
    // and reduce to just the origin: https://bucket.s3.eu-north-1.amazonaws.com
    return new URL(urlLike).origin;
  } catch {
    // If the user passed only a host without protocol, ignore it
    return null;
  }
}

function cspValue() {
  // Keep your existing connect-src allowlist
  const connect = [
    "'self'",
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
  ];

  // Keep your existing img-src allowlist (local previews need data: + blob:)
  const img = ["'self'", 'data:', 'blob:'];

  // Support both env names (front-end friendly NEXT_PUBLIC_*, or server-only)
  const s3Base =
    process.env.S3_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_S3_PUBLIC_BASE ||
    null;

  const s3Origin = normalizeOrigin(s3Base);
  if (s3Origin) {
    // Needed so the browser can PUT (pre-signed) and GET from S3
    connect.push(s3Origin);
    img.push(s3Origin);
  }

  // Build CSP string; keep your original directives/order
  return [
    "default-src 'self'",
    "frame-ancestors 'none'",
    `img-src ${img.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    // Keep dev-friendly flags you already had
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    `connect-src ${connect.join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  // Your existing security headers
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // Preserve your report-only toggle
  const reportOnly = String(process.env.CSP_REPORT_ONLY || 'true') === 'true';
  const header = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  res.headers.set(header, cspValue());

  return res;
}

// Keep your matcher as-is
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
