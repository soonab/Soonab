// src/app/api/social/trust/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentProfileId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let payload: any
  try { payload = await req.json() } catch { return NextResponse.json({ ok:false, error:'Invalid JSON' }, { status:400 }) }
  const handle = (payload?.handle ?? '').toString().trim().toLowerCase()
  if (!handle) return NextResponse.json({ ok:false, error:'handle required' }, { status:400 })

  const viewerPid = await getCurrentProfileId()
  if (!viewerPid) return NextResponse.json({ ok:false, error:'Sign in required' }, { status:401 })

  const target = await prisma.profile.findUnique({ where: { handle } })
  if (!target) return NextResponse.json({ ok:false, error:'Profile not found' }, { status:404 })
  if (target.id === viewerPid) return NextResponse.json({ ok:false, error:'Cannot trust yourself' }, { status:400 })

  // "Trust" is author → viewer edge: author (truster) chooses who can see TRUSTED posts.
  await prisma.trust.upsert({
    where: { trusterProfileId_trusteeProfileId: { trusterProfileId: viewerPid, trusteeProfileId: target.id } },
    update: {},
    create: { trusterProfileId: viewerPid, trusteeProfileId: target.id },
  })

  return NextResponse.json({ ok:true, trusted:true })
}
