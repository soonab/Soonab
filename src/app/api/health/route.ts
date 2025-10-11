import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db' // adjust to '@/lib/db' if your alias works

export async function GET() {
  try {
    // simple DB ping
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'connected' })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, db: 'error', error: String(e?.message ?? e) },
      { status: 500 }
    )
  }
}
