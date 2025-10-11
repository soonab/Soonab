import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'

export async function GET() {
  try {
    // Ping DB (Neon) to verify connectivity
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'connected' })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'db_unreachable', detail: (err as Error).message },
      { status: 500 }
    )
  }
}
