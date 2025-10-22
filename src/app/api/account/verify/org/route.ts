import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { assertSameOrigin, requireCsrf, requireJson } from '@/lib/security';
import { z } from '@/lib/zod';

const Body = z.object({
  orgName: z.string().trim().min(2).max(80),
  domain: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d), 'Invalid domain'),
});

export async function GET() {
  const pid = await getCurrentProfileId();
  if (!pid) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const latest = await prisma.orgVerification.findFirst({
    where: { profileId: pid },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orgName: true,
      domain: true,
      status: true,
      method: true,
      verifiedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, verification: latest || null });
}

export async function POST(req: NextRequest) {
  const so = assertSameOrigin(req);
  if (so) return so;
  const cs = requireCsrf(req);
  if (cs) return cs;

  const pid = await getCurrentProfileId();
  if (!pid) {
    return NextResponse.json({ ok: false, error: 'Sign in required' }, { status: 401 });
  }

  const { orgName, domain } = await requireJson(req, Body);

  const profile = await prisma.profile.findUnique({
    where: { id: pid },
    select: { userId: true },
  });

  if (!profile) {
    return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
  }

  const account = await prisma.account.findFirst({
    where: { userId: profile.userId },
    select: { email: true },
  });

  const emailDomain = account?.email?.split('@')[1]?.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  const status = emailDomain && emailDomain === normalizedDomain ? ('VERIFIED' as const) : ('PENDING' as const);

  const rec = await prisma.orgVerification.create({
    data: {
      profileId: pid,
      orgName,
      domain: normalizedDomain,
      status,
      method: 'EMAIL_DOMAIN',
      verifiedAt: status === 'VERIFIED' ? new Date() : null,
    },
    select: {
      id: true,
      orgName: true,
      domain: true,
      status: true,
      method: true,
      verifiedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, verification: rec });
}
