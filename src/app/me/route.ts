import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const pid = jar.get('pid')?.value;
  const { origin } = new URL(req.url);

  if (!pid) return NextResponse.redirect(new URL('/', origin));

  const prof = await prisma.profile.findUnique({ where: { id: pid }, select: { handle: true } });
  if (!prof) return NextResponse.redirect(new URL('/', origin));

  return NextResponse.redirect(new URL(`/s/${prof.handle}`, origin));
}
