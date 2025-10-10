import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/db'

export async function GET() {
  try {
    const count = await prisma.setupCheck.count()
    return NextResponse.json({ ok: true, db: 'connected', setupCheckRows: count })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
