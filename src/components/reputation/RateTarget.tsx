'use client';

import InteractiveStars from './InteractiveStars';

export default function RateTarget(props: {
  targetHandle?: string | null;
  targetProfileId?: string | null;
  initialPercent?: number | null;
  initialMean?: number | null;
}) {
  const { targetHandle, targetProfileId, initialPercent = null, initialMean = null } = props;
  const canRate = Boolean(targetProfileId && targetHandle && targetHandle !== 'anon');

  if (!canRate) {
    return (
      <span className="text-xs text-gray-500" title="Ratings require a signed profile">
        ★
      </span>
    );
  }

  return (
    <InteractiveStars
      targetHandle={targetHandle!}
      initialPercent={initialPercent}
      initialMean={initialMean}
    />
  );
}
