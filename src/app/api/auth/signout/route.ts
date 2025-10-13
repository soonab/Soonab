import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth';

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
