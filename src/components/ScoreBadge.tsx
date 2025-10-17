export default function ScoreBadge({ bm, count }:{ bm?: number|null, count?: number|null }) {
  const val = typeof bm === 'number' ? bm : 0;
  const txt = val ? val.toFixed(2) : '—';
  const total = typeof count === 'number' ? count : null;

  const label = total != null ? `Rating ${txt} from ${total} votes` : `Rating ${txt}`;

  return (
    <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 border" aria-label={label}>
      <span aria-hidden>★</span>
      <span>{txt}</span>
      {total != null && (
        <span className="text-[color:var(--ink-500)]" aria-hidden>
          ({total})
        </span>
      )}
    </span>
  );
}
