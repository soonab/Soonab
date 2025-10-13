import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';

function tomb() {
  return 'tomb-' + Math.random().toString(36).slice(2, 8);
}

export async function POST() {
  const pid = await getCurrentProfileId();
  if (!pid) return NextResponse.json({ ok: false, error: 'not signed in' }, { status: 401 });

  // Soft delete: mark and rotate handle
  const newHandle = tomb();
  await prisma.profile.update({
    where: { id: pid },
    data: { isDeleted: true, handle: newHandle },
  });

  return NextResponse.json({ ok: true, handle: newHandle });
}
