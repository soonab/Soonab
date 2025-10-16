// src/app/api/auth/google/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/db';

function b64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safePath(p?: string | null) {
  if (!p) return '/me';
  return p.startsWith('/') && !p.startsWith('//') ? p : '/me';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = safePath(url.searchParams.get('redirect'));

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.OAUTH_REDIRECT_URL!; // e.g. http://localhost:3000/api/auth/google/callback

  if (!clientId || !redirectUri) {
    // absolute URL for Next 15
    return NextResponse.redirect(new URL('/login?error=server_misconfig', req.url));
  }

  // PKCE + state + nonce
  const codeVerifier = b64url(randomBytes(32));
  const codeChallenge = b64url(createHash('sha256').update(codeVerifier).digest());
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));

  // Tie to anonymous session if present
  const jar = await cookies();
  const sid = jar.get('sid')?.value || null;

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await prisma.oAuthState.create({
    data: { state, codeVerifier, nonce, sessionId: sid || undefined, redirectTo, expiresAt },
  });

  // Google auth URL
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.searchParams.set('client_id', clientId);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('scope', 'openid email profile');
  auth.searchParams.set('include_granted_scopes', 'true');
  auth.searchParams.set('access_type', 'online');
  auth.searchParams.set('prompt', 'select_account');
  auth.searchParams.set('state', state);
  auth.searchParams.set('nonce', nonce);
  auth.searchParams.set('code_challenge', codeChallenge);
  auth.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(auth.toString(), { headers: { 'Cache-Control': 'no-store' } });
}
