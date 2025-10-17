'use client';

import { useState } from 'react';
import BodyText from '@/components/BodyText';
import ScoreBadge from '@/components/ScoreBadge';
import StarRater from '@/components/StarRater';
import ReportButton from '@/components/ReportButton';
import ReplyComposer from '@/components/ReplyComposer';

export type ApiReply = {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  sessionId: string | null;
  profileId: string | null;
};

export type ApiPost = {
  id: string;
  body: string;
  createdAt: string;
  sessionId: string | null;
  profileId: string | null;
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'TRUSTED';
  replies: ApiReply[];
};

export type SessionProfileInfo = { sessionId: string; handle: string };
export type ReputationInfo = { sessionId: string; count: number; bayesianMean: number };

interface Props {
  tag: string;
  initialItems: ApiPost[];
  initialCursor: string | null;
  initialSessions: SessionProfileInfo[];
  initialScores: ReputationInfo[];
}

export default function TagFeed({ tag, initialItems, initialCursor, initialSessions, initialScores }: Props) {
  const [items, setItems] = useState<ApiPost[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionMap, setSessionMap] = useState<Record<string, SessionProfileInfo>>(() => {
    const map: Record<string, SessionProfileInfo> = {};
    for (const entry of initialSessions) {
      map[entry.sessionId] = entry;
    }
    return map;
  });

  const [scoreMap, setScoreMap] = useState<Record<string, ReputationInfo>>(() => {
    const map: Record<string, ReputationInfo> = {};
    for (const entry of initialScores) {
      map[entry.sessionId] = entry;
    }
    return map;
  });

  const hasMore = Boolean(nextCursor);

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('cursor', nextCursor);
      const res = await fetch(`/api/tags/${encodeURIComponent(tag)}?${qs.toString()}`);
      if (!res.ok) {
        throw new Error('Request failed');
      }
      const data: {
        ok: boolean;
        items: ApiPost[];
        nextCursor: string | null;
        sessionProfiles: SessionProfileInfo[];
        reputationScores: ReputationInfo[];
      } = await res.json();
      if (!data.ok) {
        throw new Error('Server returned an error');
      }
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor ?? null);
      setSessionMap((prev) => {
        const next = { ...prev };
        for (const entry of data.sessionProfiles) {
          next[entry.sessionId] = entry;
        }
        return next;
      });
      setScoreMap((prev) => {
        const next = { ...prev };
        for (const entry of data.reputationScores) {
          next[entry.sessionId] = entry;
        }
        return next;
      });
    } catch {
      setError('Could not load more posts.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-6">
        {items.map((p) => {
          const sessionInfo = p.sessionId ? sessionMap[p.sessionId] : undefined;
          const scoreInfo = p.sessionId ? scoreMap[p.sessionId] : undefined;
          const handle = sessionInfo?.handle ?? 'anon';

          return (
            <li key={p.id} className="feed-card">
              <div className="mb-1 flex items-center gap-2 text-xs">
                <a className="underline" href={`/s/${handle}`}>
                  @{handle}
                </a>
                <ScoreBadge bm={scoreInfo?.bayesianMean} count={scoreInfo?.count} />
                <StarRater targetHandle={handle} />
              </div>

              <BodyText text={p.body} />

              <div className="mt-2 text-xs text-gray-500">
                {new Date(p.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
              </div>

              <div className="mt-2">
                <ReportButton targetType="POST" targetId={p.id} />
              </div>

              {p.replies.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {p.replies.map((r) => {
                    const rSession = r.sessionId ? sessionMap[r.sessionId] : undefined;
                    const rScore = r.sessionId ? scoreMap[r.sessionId] : undefined;
                    const rHandle = rSession?.handle ?? 'anon';
                    return (
                      <li key={r.id} className="card">
                        <div className="mb-1 flex items-center gap-2 text-[11px]">
                          <a className="underline" href={`/s/${rHandle}`}>
                            @{rHandle}
                          </a>
                          <ScoreBadge bm={rScore?.bayesianMean} count={rScore?.count} />
                          <StarRater targetHandle={rHandle} />
                        </div>
                        <BodyText text={r.body} />
                        <div className="mt-1 text-[11px] text-gray-500">
                          {new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19)} UTC
                        </div>
                        <div className="mt-1">
                          <ReportButton targetType="REPLY" targetId={r.id} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ReplyComposer postId={p.id} />
            </li>
          );
        })}
        {items.length === 0 && <li className="text-sm text-gray-500">No posts yet.</li>}
      </ul>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
