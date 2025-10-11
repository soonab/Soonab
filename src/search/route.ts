import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ ok: true, posts: [] })
  const posts = await prisma.post.findMany({
    where: {
      AND: [
        { visibility: 'PUBLIC' },
        { body: { contains: q, mode: 'insensitive' } }
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return NextResponse.json({ ok: true, posts })
}
