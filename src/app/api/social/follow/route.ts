// src/app/api/social/follow/route.ts
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
  if (target.id === viewerPid) return NextResponse.json({ ok:false, error:'Cannot follow yourself' }, { status:400 })

  await prisma.follow.upsert({
    where: { followerProfileId_followingProfileId: { followerProfileId: viewerPid, followingProfileId: target.id } },
    update: {},
    create: { followerProfileId: viewerPid, followingProfileId: target.id },
  })

  return NextResponse.json({ ok:true, following:true })
}
