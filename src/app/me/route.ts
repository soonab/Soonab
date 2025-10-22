// src/app/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Use the same helper your other APIs use (works with Google OAuth + email links)
  const pid = await getCurrentProfileId();
  const origin = new URL(req.url);

  // Not signed in -> go to login
  if (!pid) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  // Find the owner handle
  const prof = await prisma.profile.findUnique({
    where: { id: pid },
    select: { handle: true },
  });

  // No handle yet -> send to settings to finish setup
  if (!prof?.handle) {
    return NextResponse.redirect(new URL('/settings', origin));
  }

  // Happy path -> jump to /s/<handle>
  return NextResponse.redirect(new URL(`/s/${prof.handle}`, origin));
}
