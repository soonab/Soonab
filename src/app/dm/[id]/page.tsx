// src/app/dm/[id]/page.tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentProfileId } from '@/lib/auth';
import { findConversationForParticipant } from '@/lib/dm';
import MessageComposer from '@/components/dm/MessageComposer';
import AcceptInviteButton from '@/components/dm/AcceptInviteButton';
import BlockConversationButton from '@/components/dm/BlockConversationButton';
import ReportConversationForm from '@/components/dm/ReportConversationForm';

const messageInclude = {
  sender: { select: { id: true, handle: true, displayName: true } },
};

function formatTimestamp(date: Date) {
  return new Date(date).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const cursor = search?.cursor ?? undefined;

  const profileId = await getCurrentProfileId();
  if (!profileId) {
    return (
      <div className="card space-y-3">
        <h1 className="text-xl font-semibold">Direct Messages</h1>
        <p className="text-sm text-gray-600">Sign in to open this conversation.</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded bg-[var(--brand-teal)] px-3 py-1.5 text-sm font-semibold text-white"
        >
          Go to sign-in
        </Link>
      </div>
    );
  }

  const conversation = await findConversationForParticipant(id, profileId);
  if (!conversation) {
    return (
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">Conversation not found</h1>
        <p className="text-sm text-gray-600">This private thread may have been removed or you no longer have access.</p>
        <Link href="/dm" className="text-sm text-[color:var(--brand-teal)] underline">
          Back to conversations
        </Link>
      </div>
    );
  }

  let messages;
  try {
    messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
      include: messageInclude,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  } catch {
    return (
      <div className="card space-y-2">
        <h1 className="text-xl font-semibold">Conversation</h1>
        <p className="text-sm text-red-600">Invalid cursor. Try reloading the thread.</p>
        <Link href={`/dm/${id}`} className="text-sm text-[color:var(--brand-teal)] underline">
          Reload conversation
        </Link>
      </div>
    );
  }

  const nextCursor = messages.length === 50 ? messages[messages.length - 1]!.id : null;

  const other =
    conversation.memberA.id === profileId ? conversation.memberB : conversation.memberA;
  const blockedByYou = conversation.blocks.some((b) => b.blockerId === profileId);
  const blockedYou = conversation.blocks.some((b) => b.blockedId === profileId && b.blockerId !== profileId);
  const composerDisabled =
    conversation.status !== 'ACTIVE' || blockedByYou || blockedYou;
  let disabledReason: string | undefined;
  if (conversation.status === 'PENDING') {
    disabledReason = 'Awaiting acceptance before you can chat.';
  } else if (conversation.status === 'BLOCKED') {
    disabledReason = 'This conversation is blocked.';
  } else if (blockedByYou) {
    disabledReason = 'You have blocked this conversation.';
  } else if (blockedYou) {
    disabledReason = 'You have been blocked from this conversation.';
  }

  const showAccept = conversation.status === 'PENDING' && conversation.createdBy.id !== profileId;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dm" className="text-sm text-[color:var(--brand-teal)] underline">
            ← All conversations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">@{other.handle}</h1>
          {other.displayName && (
            <p className="text-sm text-gray-600">{other.displayName}</p>
          )}
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>Status: {conversation.status}</div>
          <div>Started {formatTimestamp(conversation.createdAt)}</div>
        </div>
      </div>

      {blockedByYou && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700">
          You&rsquo;ve blocked this conversation. Unblock from account settings if this was a mistake.
        </div>
      )}
      {blockedYou && !blockedByYou && (
        <div className="card border-red-200 bg-red-50 text-sm text-red-700">
          The other participant has blocked you. You can no longer send messages.
        </div>
      )}

      {showAccept && (
        <div className="card space-y-2">
          <p className="text-sm text-gray-700">
            @{conversation.createdBy.id === conversation.memberA.id ? conversation.memberA.handle : conversation.memberB.handle}{' '}
            invited you to chat. Accept to start messaging.
          </p>
          <AcceptInviteButton conversationId={conversation.id} />
        </div>
      )}

      <div className="card space-y-3">
        <div aria-live="polite" className="space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-gray-500">No messages yet.</p>
          )}
          {messages.map((message) => {
            const mine = message.senderId === profileId;
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm shadow-sm whitespace-pre-wrap break-words ${
                    mine
                      ? 'border-[var(--brand-teal)] bg-[var(--brand-teal)] text-white'
                      : 'border-[var(--outline)] bg-white text-[color:var(--ink-900)]'
                  }`}
                  aria-label={`Message from ${mine ? 'you' : '@' + message.sender.handle}`}
                >
                  <div className="text-[11px] opacity-80">
                    {mine ? 'You' : `@${message.sender.handle}`}{' '}
                    <span>{formatTimestamp(message.createdAt)}</span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words">{message.body}</div>
                </div>
              </div>
            );
          })}
        </div>
        {nextCursor && (
          <div className="text-center">
            <Link
              href={`/dm/${id}?cursor=${nextCursor}`}
              className="text-sm text-[color:var(--brand-teal)] underline"
            >
              Load newer messages
            </Link>
          </div>
        )}
      </div>

      <MessageComposer
        conversationId={conversation.id}
        disabled={composerDisabled}
        disabledReason={disabledReason}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <BlockConversationButton conversationId={conversation.id} alreadyBlocked={blockedByYou} />
        <ReportConversationForm conversationId={conversation.id} />
      </div>
    </div>
  );
}
