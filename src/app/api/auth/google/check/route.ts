import { NextResponse } from 'next/server';

function mask(s: string) {
  if (!s) return '';
  return s.length <= 14 ? s : `${s.slice(0, 8)}…${s.slice(-6)}`;
}

export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const redirectUri = process.env.OAUTH_REDIRECT_URL || '';
  return NextResponse.json({
    clientIdMasked: mask(clientId),
    redirectUri,
    hasSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
  });
}
