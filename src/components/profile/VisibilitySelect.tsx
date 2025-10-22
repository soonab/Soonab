'use client';
import type { Visibility } from '@prisma/client';

const LABELS: Record<Visibility, string> = {
  PUBLIC: 'Public',
  FOLLOWERS: 'Followers',
  TRUSTED: 'Trusted',
};

export function VisibilitySelect({
  value, onChange, id,
}: { value: Visibility; onChange: (v: Visibility) => void; id: string }) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value as Visibility)}
      className="rounded border px-2 py-1 text-xs"
    >
      {(['PUBLIC', 'FOLLOWERS', 'TRUSTED'] as Visibility[]).map(v => (
        <option key={v} value={v}>{LABELS[v]}</option>
      ))}
    </select>
  );
}
