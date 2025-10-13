import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { Visibility } from '@prisma/client';
import { canCreatePost } from '@/lib/limits';
import { ensureSessionProfile } from '@/lib/identity';
import { getCurrentProfileId } from '@/lib/auth';

const POST_MAX = 500;

function extractHashtags(text: string): string[] {
  const set = new Set<string>();
  const re = /#([A-Za-z0-9_]{1,50})/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1].toLowerCase());
  return Array.from(set);
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 100);
  const posts = await prisma.post.findMany({
    where: { visibility: 'PUBLIC' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json({ ok: true, posts });
}

export async function POST(req: NextRequest) {
  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const body = (payload?.body ?? '').toString().trim();
  if (!body) return NextResponse.json({ ok: false, error: 'Body is required' }, { status: 400 });
  if (body.length > POST_MAX) return NextResponse.json({ ok: false, error: `Too long (max ${POST_MAX})` }, { status: 400 });

  const jar = await cookies();                             // ✅ Next 15
  let sid = jar.get('sid')?.value;
  let setCookie = false;
  if (!sid) { sid = randomUUID(); setCookie = true; }

  await ensureSessionProfile(sid);
  const profileId = await getCurrentProfileId();           // may be null

  const gate = await canCreatePost(sid, profileId);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 429 });

  const hashtags = extractHashtags(body);
  const created = await prisma.post.create({
    data: { sessionId: sid, profileId, body, visibility: Visibility.PUBLIC },
  });

  const res = NextResponse.json({ ok: true, post: created, hashtags, quota: gate.quota ?? null });
  if (setCookie) {
    res.cookies.set('sid', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}
