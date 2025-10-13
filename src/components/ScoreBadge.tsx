export default function ScoreBadge({ bm, count }:{ bm?: number|null, count?: number|null }) {
  const val = typeof bm === 'number' ? bm : 0;
  const txt = val ? val.toFixed(2) : '—';
  return (
    <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 border">
      <span aria-hidden>★</span>
      <span>{txt}</span>
    </span>
  );
}
