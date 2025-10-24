type Props = {
  bm?: number | null;
  showStar?: boolean; // set false to hide the ★ glyph if you want pure number
};

/** Format Bayesian mean (0..5) as "4.4". */
function formatMean(bm?: number | null): string {
  if (typeof bm !== 'number' || Number.isNaN(bm)) return '—';
  const clamped = Math.max(0, Math.min(5, bm));
  return clamped.toFixed(1);
}

export default function ReputationPercentBadge({ bm, showStar = true }: Props) {
  const text = formatMean(bm); // e.g., "4.4"
  return (
    <span className="badge">
      {showStar && '★ '}{text}
    </span>
  );
}
