// src/app/api/auth/google/callback/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { setAuthCookie, getClientIpAndUA } from '@/lib/auth';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

function safePath(p?: string | null) {
  if (!p) return '/me';
  return p.startsWith('/') && !p.startsWith('//') ? p : '/me';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(error), req.url));
  if (!code || !state) return NextResponse.redirect(new URL('/login?error=missing_params', req.url));

  // Load & validate state
  const row = await prisma.oAuthState.findUnique({ where: { state } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.OAUTH_REDIRECT_URL!;

  // Exchange code (PKCE)
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: row.codeVerifier,
    }),
  });
  if (!tokenResp.ok) return NextResponse.redirect(new URL('/login?error=token_exchange_failed', req.url));

  const tokens = (await tokenResp.json()) as any;
  const idToken = tokens.id_token as string | undefined;
  if (!idToken) return NextResponse.redirect(new URL('/login?error=missing_id_token', req.url));

  // Verify ID token
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, { audience: clientId, issuer: ISSUERS });
  if (payload.nonce !== row.nonce) return NextResponse.redirect(new URL('/login?error=bad_nonce', req.url));

  // Normalize claims
  const email = String(payload.email || '').toLowerCase();
  const emailVerified = Boolean(payload.email_verified);
  const sub = String(payload.sub || '');
  const name = String(payload.name || '').trim();

  if (!email || !emailVerified || !sub) {
    return NextResponse.redirect(new URL('/login?error=incomplete_claims', req.url));
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) user = await prisma.user.create({ data: { email } });

  // Link account
  const acct = await prisma.account.findUnique({
    where: { provider_providerId: { provider: 'GOOGLE', providerId: sub } },
  });
  if (!acct) {
    await prisma.account.create({ data: { userId: user.id, provider: 'GOOGLE', providerId: sub, email } });
  } else if (acct.userId !== user.id) {
    return NextResponse.redirect(new URL('/login?error=account_linked_elsewhere', req.url));
  }

  // Ensure at least one profile
  const profCount = await prisma.profile.count({ where: { userId: user.id } });
  if (profCount === 0) {
    const at = email.indexOf('@');
    const local = at > 0 ? email.slice(0, at) : email;
    const baseHandle =
      (name || local).toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 20) || 'user';

    let handle = baseHandle; let i = 1;
    while (await prisma.profile.findUnique({ where: { handle } })) {
      handle = `${baseHandle}${i++}`;
    }
    await prisma.profile.create({ data: { userId: user.id, handle } });
  }

  // Audit
  const { ip, ua } = await getClientIpAndUA();
  await prisma.loginEvent.create({ data: { userId: user.id, method: 'GOOGLE', ip, userAgent: ua } });

  // Mark state used
  await prisma.oAuthState.update({ where: { state }, data: { usedAt: new Date() } });

  // Ensure anonymous sid continuity
  const jar = await cookies();
  if (!jar.get('sid')) {
    const { randomUUID } = await import('crypto');
    jar.set('sid', randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // Set auth cookie and redirect
  await setAuthCookie(user.id);

  const finalPath = safePath(row.redirectTo);
  return NextResponse.redirect(new URL(finalPath, req.url));
}
