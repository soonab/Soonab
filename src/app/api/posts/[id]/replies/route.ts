import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { Visibility } from '@prisma/client'
import { canCreateReply } from '@/lib/limits'
import { ensureSessionProfile } from '@/lib/identity'

const REPLY_MAX = 500

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const postId = params.id

  // Check parent post exists
  const parent = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  })
  if (!parent) {
    return NextResponse.json(
      { ok: false, error: 'Post not found' },
      { status: 404 }
    )
  }

  // Parse JSON body
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  const body = (payload?.body ?? '').toString().trim()
  if (!body) {
    return NextResponse.json(
      { ok: false, error: 'Body is required' },
      { status: 400 }
    )
  }
  if (body.length > REPLY_MAX) {
    return NextResponse.json(
      { ok: false, error: `Too long (max ${REPLY_MAX})` },
      { status: 400 }
    )
  }

  // Session cookie
  const jar = cookies()
  let sid = jar.get('sid')?.value
  let setCookie = false
  if (!sid) {
    sid = randomUUID()
    setCookie = true
  }

  // Ensure pseudonymous profile and check reply quota
  await ensureSessionProfile(sid)
  const gate = await canCreateReply(sid, postId)
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: gate.error },
      { status: 429 }
    )
  }

  // Create reply
  const created = await prisma.reply.create({
    data: {
      postId,
      sessionId: sid,
      body,
      visibility: Visibility.PUBLIC,
    },
  })

  // Respond
  const res = NextResponse.json({ ok: true, reply: created, quota: gate.quota ?? null })

  if (setCookie) {
    res.cookies.set('sid', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return res
}
