// src/app/api/csp-report/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    console.warn('CSP report:', JSON.stringify(body));
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}
