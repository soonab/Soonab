// src/app/api/admin/moderation/action/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

type Body = {
  action: 'HIDE'|'UNHIDE'|'REMOVE'|'BLOCK_PROFILE'|'UNBLOCK_PROFILE',
  targetType?: 'POST'|'REPLY'|'PROFILE',
  targetId?: string,
  profileHandle?: string,
  reason?: string
}

function forbid() { return NextResponse.json({ ok:false }, { status:403 }) }

export async function POST(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  if (key !== process.env.ADMIN_KEY) return forbid()

  const body = (await req.json()) as Body
  const actor = 'admin:console' // ← do not leak secret

  if (body.action === 'HIDE' || body.action === 'UNHIDE' || body.action === 'REMOVE') {
    if (!body.targetType || !body.targetId || body.targetType === 'PROFILE') {
      return NextResponse.json({ error:'missing/invalid target' }, { status:400 })
    }
    const isPost = body.targetType === 'POST'

    // Guard: cannot UNHIDE after REMOVED
    if (body.action === 'UNHIDE') {
      const current = isPost
        ? await prisma.post.findUnique({ where: { id: body.targetId }, select: { state: true } })
        : await prisma.reply.findUnique({ where: { id: body.targetId }, select: { state: true } })
      if (!current) return NextResponse.json({ error:'not found' }, { status:404 })
      if (current.state === 'REMOVED') return NextResponse.json({ error:'cannot unhide removed' }, { status:400 })
    }

    const newState = body.action === 'HIDE' ? 'HIDDEN' : body.action === 'UNHIDE' ? 'ACTIVE' : 'REMOVED'
    if (isPost) await prisma.post.update({ where: { id: body.targetId }, data: { state: newState } })
    else        await prisma.reply.update({ where: { id: body.targetId }, data: { state: newState } })

    await prisma.moderationAction.create({
      data: {
        actor, targetType: body.targetType, targetId: body.targetId,
        action: body.action, reason: body.reason
      }
    })

    return NextResponse.json({ ok:true })
  }

  if (body.action === 'BLOCK_PROFILE' || body.action === 'UNBLOCK_PROFILE') {
    if (!body.profileHandle) return NextResponse.json({ error:'missing profileHandle' }, { status:400 })
    const profile = await prisma.profile.findUnique({ where: { handle: body.profileHandle.toLowerCase() } })
    if (!profile) return NextResponse.json({ error:'profile not found' }, { status:404 })

    if (body.action === 'BLOCK_PROFILE') {
      await prisma.profilePenalty.create({
        data: { profileId: profile.id, kind: 'PERMA_BAN', until: null, reason: body.reason } // ← explicit
      })
      await prisma.moderationAction.create({
        data: { actor, targetType: 'PROFILE', profileId: profile.id, targetId: null, action: 'BLOCK_PROFILE', reason: body.reason }
      })
    } else {
      await prisma.profilePenalty.updateMany({ where: { profileId: profile.id, resolvedAt: null }, data: { resolvedAt: new Date() } })
      await prisma.moderationAction.create({
        data: { actor, targetType: 'PROFILE', profileId: profile.id, targetId: null, action: 'UNBLOCK_PROFILE', reason: body.reason }
      })
    }
    return NextResponse.json({ ok:true })
  }

  return NextResponse.json({ error:'unknown action' }, { status:400 })
}
