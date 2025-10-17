// src/app/api/social/unfollow/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentProfileId } from '@/lib/auth'
import { assertSameOrigin, requireJson } from '@/lib/security'

export async function POST(req: NextRequest) {
  assertSameOrigin(req)

  const payload = await requireJson<{ handle: string }>(req)
  const handle = (payload?.handle ?? '').toString().trim().toLowerCase()
  if (!handle) return NextResponse.json({ ok:false, error:'handle required' }, { status:400 })

  const viewerPid = await getCurrentProfileId()
  if (!viewerPid) return NextResponse.json({ ok:false, error:'Sign in required' }, { status:401 })

  const target = await prisma.profile.findUnique({ where: { handle } })
  if (!target) return NextResponse.json({ ok:false, error:'Profile not found' }, { status:404 })
  if (target.id === viewerPid) return NextResponse.json({ ok:false, error:'Cannot unfollow yourself' }, { status:400 })

  await prisma.follow.deleteMany({
    where: {
      followerProfileId: viewerPid,
      followingProfileId: target.id,
    },
  })
  return NextResponse.json({ ok:true, following:false })
}
