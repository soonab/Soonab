// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

function cspValue() {
  const connect = [
    "'self'",
    'https://accounts.google.com',
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
  ];
  return [
    "default-src 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // dev-friendly
    `connect-src ${connect.join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  const reportOnly = String(process.env.CSP_REPORT_ONLY || 'true') === 'true';
  const header = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  res.headers.set(header, cspValue());

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
