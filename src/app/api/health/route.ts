import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`; // DB ping
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'db_unreachable' }, { status: 503 });
  }
}
