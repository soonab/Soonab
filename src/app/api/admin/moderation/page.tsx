// src/app/admin/moderation/page.tsx
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  if (key !== process.env.ADMIN_KEY) {
    return <main className="card"><h1 className="text-xl font-semibold">Forbidden</h1></main>;
  }

  const reports = await prisma.moderationReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  async function excerpt(rt: 'POST'|'REPLY', id: string) {
    if (rt === 'POST') {
      const p = await prisma.post.findUnique({ where: { id }, select: { body: true, state: true } });
      return p ? `[${p.state}] ${p.body.slice(0,160)}` : '(missing)';
    }
    const r = await prisma.reply.findUnique({ where: { id }, select: { body: true, state: true } });
    return r ? `[${r.state}] ${r.body.slice(0,160)}` : '(missing)';
  }

  async function act(a: 'HIDE'|'UNHIDE'|'REMOVE', rt: 'POST'|'REPLY', tid: string) {
    'use server';
    await fetch(`/api/admin/moderation/action?key=${process.env.ADMIN_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ action: a, targetType: rt, targetId: tid, reason: 'inbox' })
    });
    revalidatePath('/admin/moderation');
  }

  return (
    <main className="space-y-4 p-4">
      <div className="glass px-4 py-3"><h1 className="text-xl font-semibold">Moderation Inbox</h1></div>
      <ul className="space-y-3">
        {await Promise.all(reports.map(async rep => {
          const body = await excerpt(rep.targetType as any, rep.targetId);
          return (
            <li key={rep.id} className="card p-3">
              <div className="text-xs opacity-70">{rep.createdAt.toISOString()}</div>
              <div className="mt-1 font-mono text-sm">{rep.targetType}:{rep.targetId}</div>
              <div className="mt-1 text-sm">{body}</div>
              <div className="mt-3 flex gap-2">
                <form action={act.bind(null,'HIDE', rep.targetType as any, rep.targetId)}>
                  <button className="btn-ghost text-xs">Hide</button>
                </form>
                <form action={act.bind(null,'UNHIDE', rep.targetType as any, rep.targetId)}>
                  <button className="btn-ghost text-xs">Unhide</button>
                </form>
                <form action={act.bind(null,'REMOVE', rep.targetType as any, rep.targetId)}>
                  <button className="btn-ghost text-xs">Remove</button>
                </form>
              </div>
            </li>
          );
        }))}
      </ul>
    </main>
  );
}
