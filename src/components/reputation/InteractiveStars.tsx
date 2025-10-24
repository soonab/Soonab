'use client';

import { useMemo, useState } from 'react';

function getCsrfHeaders() {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="csrf"]') as HTMLMetaElement | null;
    const token = meta?.content || (typeof window !== 'undefined' ? (window as any).__CSRF : undefined);
    if (token) {
      h['X-CSRF'] = token;
      h['X-CSRF-Token'] = token;
    }
  }
  return h;
}

type Props = {
  targetHandle: string;                 // e.g. "nick"
  initialPercent?: number | null;       // e.g. 92.0
  initialMean?: number | null;          // e.g. 4.6 (out of 5)
  size?: number;                        // star size in px
};

export default function InteractiveStars({ targetHandle, initialPercent = null, initialMean = null, size = 16 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [percent, setPercent] = useState<number | null>(initialPercent);
  const [mean, setMean] = useState<number | null>(initialMean);
  const [thanks, setThanks] = useState(false);

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  async function rate(v: number) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/reputation/rate', {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders(),
        body: JSON.stringify({ targetHandle, value: v }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j.error || `Failed with ${res.status}`);
      }

      const j = await res.json().catch(() => ({} as any));
      // Expecting { scorePercent, bayesianMean } when backend implements ADR-0011.
      if (typeof j.scorePercent === 'number') setPercent(j.scorePercent);
      if (typeof j.bayesianMean === 'number') setMean(j.bayesianMean);
      setValue(v);
      setThanks(true);
      setTimeout(() => setThanks(false), 2000);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center">
        {stars.map((s) => {
          const active = (hover ?? value ?? 0) >= s;
          return (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
              onClick={() => rate(s)}
              disabled={busy}
              aria-label={`${s} star`}
              className={`p-0.5 ${busy ? 'opacity-60' : 'hover:scale-[1.05]'}`}
              style={{ lineHeight: 0 }}
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
      </div>
      <div className="text-xs text-gray-600">
        {percent != null || mean != null ? (
          <span>
            {percent != null ? `${percent.toFixed(1)}%` : '—'} · {mean != null ? `${mean.toFixed(1)}/5` : '—'}
          </span>
        ) : (
          <span>Rate</span>
        )}
      </div>
      {thanks && <span className="text-xs text-green-600">Thanks!</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
