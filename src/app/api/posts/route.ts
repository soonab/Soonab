import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { Visibility } from '@prisma/client';
import { canCreatePost } from '@/lib/limits';
import { ensureSessionProfile } from '@/lib/identity';

const POST_MAX = 500;

function extractHashtags(text: string): string[] {
  const set = new Set<string>();
  const re = /#([A-Za-z0-9_]{1,50})/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1].toLowerCase());
  return Array.from(set);
}

// GET /api/posts
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 50, 100);
  const posts = await prisma.post.findMany({
    where: { visibility: 'PUBLIC' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return NextResponse.json({ ok: true, posts });
}

// POST /api/posts
export async function POST(req: NextRequest) {
  // Parse payload
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const body = (payload?.body ?? '').toString().trim();
  if (!body) return NextResponse.json({ ok: false, error: 'Body is required' }, { status: 400 });
  if (body.length > POST_MAX) {
    return NextResponse.json({ ok: false, error: `Too long (max ${POST_MAX})` }, { status: 400 });
  }

  // Session cookie (Next 15: must await cookies())
  const jar = await cookies();
  let sid = jar.get('sid')?.value;
  let setCookie = false;
  if (!sid) { sid = randomUUID(); setCookie = true; }

  // Ensure profile & quota
  await ensureSessionProfile(sid);
  const gate = await canCreatePost(sid); // if your limits use profileId, pass it instead
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 429 });

  // Create post
  const hashtags = extractHashtags(body);
  const created = await prisma.post.create({
    data: { sessionId: sid, body, visibility: Visibility.PUBLIC },
  });

  // Respond (and set cookie if new)
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
