'use client';

import { useMemo, useState } from 'react';

function getCsrfHeaders() {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="csrf"]') as HTMLMetaElement | null;
    const token = meta?.content || (typeof window !== 'undefined' ? (window as any).__CSRF : undefined);
    if (token) { h['X-CSRF'] = token; h['X-CSRF-Token'] = token; }
  }
  return h;
}

type Props = {
  replyId: string;
  initialLocked?: boolean;
  size?: number;
  disabled?: boolean;
};

export default function RateReplyStars({ replyId, initialLocked = false, size = 14, disabled = false }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState<boolean>(initialLocked || disabled);
  const [msg, setMsg] = useState<string | null>(null);

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  async function rate(v: number) {
    if (busy || locked) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/replies/${replyId}/rate`, {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders(),
        body: JSON.stringify({ value: v }),
      });

      if (res.status === 403) {
        setMsg('Own reply');
        setLocked(true);
        return;
      }
      if (res.status === 409) {
        setMsg('Already rated');
        setLocked(true);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j.error || `Failed (${res.status})`);
      }

      setValue(v);
      setLocked(true);
      setMsg('Thanks!');
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      setMsg(e.message || 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-flex ${locked ? 'opacity-70' : ''}`}>
        {stars.map((s) => {
          const active = (hover ?? value ?? 0) >= s;
          return (
            <button
              key={s}
              type="button"
              onMouseEnter={() => !locked && setHover(s)}
              onMouseLeave={() => setHover(null)}
              onClick={() => rate(s)}
              disabled={busy || locked}
              aria-label={`${s} star`}
              className={`p-0.5 ${busy || locked ? '' : 'hover:scale-[1.05]'}`}
              style={{ lineHeight: 0 }}
              title={locked ? 'Rating locked' : 'Rate this reply'}
            >
              <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.786 1.401 8.166L12 18.896l-7.335 3.866 1.401-8.166L.132 9.21l8.2-1.192z"
                  fill={active ? 'currentColor' : 'none'}
                  stroke="currentColor"
                />
              </svg>
            </button>
          );
        })}
      </span>
      <span className="text-[11px] text-gray-600 select-none">{msg ?? (locked ? 'Rated' : 'Rate')}</span>
    </span>
  );
}
