// src/app/dm/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { conversationSummaryInclude } from '@/lib/dm';

function formatTimestamp(date: Date | null) {
  if (!date) return '—';
  return new Date(date).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function preview(body: string | undefined) {
  if (!body) return 'No messages yet';
  const trimmed = body.trim();
  if (!trimmed) return 'No messages yet';
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}

export default async function DirectMessagesPage() {
  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return (
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold">Direct Messages</h1>
        <p className="text-sm text-gray-600">
          Sign in to view and send private messages.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded bg-[var(--brand-teal)] px-3 py-1.5 text-sm font-semibold text-white"
        >
          Go to sign-in
        </Link>
      </div>
    );
  }

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ memberAId: profileId }, { memberBId: profileId }] },
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: 100,
    include: conversationSummaryInclude,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Direct Messages</h1>
        <Link
          href="/settings"
          className="text-sm text-[color:var(--brand-teal)] underline"
        >
          Safety controls
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="card text-sm text-gray-600">
          <p>No conversations yet. Start a trusted connection to invite someone.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {conversations.map((conversation) => {
            const other =
              conversation.memberA.id === profileId
                ? conversation.memberB
                : conversation.memberA;
            const latest = conversation.messages[0];
            const blockedByYou = conversation.blocks.some((b) => b.blockerId === profileId);
            const blockedYou = conversation.blocks.some((b) => b.blockedId === profileId && b.blockerId !== profileId);

            return (
              <li key={conversation.id} className="card">
                <Link href={`/dm/${conversation.id}`} className="block">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold">
                        @{other.handle}
                        {other.displayName && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            {other.displayName}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {preview(latest?.body)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{formatTimestamp(conversation.lastMessageAt ?? conversation.createdAt)}</span>
                        {conversation.status === 'PENDING' && <span className="badge">Pending invite</span>}
                        {conversation.status === 'BLOCKED' && <span className="badge bg-red-100 text-red-700">Blocked</span>}
                        {blockedByYou && <span className="badge bg-red-100 text-red-700">You blocked</span>}
                        {blockedYou && <span className="badge bg-red-100 text-red-700">Blocked you</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
