// src/components/BodyText.tsx
import Link from 'next/link';

export default function BodyText({ text }: { text: string }) {
  const parts: (string | { tag: string })[] = [];
  const re = /#([A-Za-z0-9_]{1,50})/g;

  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tag = m[1] ?? ''; // ✅ null-safe tag capture
    parts.push({ tag });
    last = re.lastIndex;
  }

  if (last < text.length) parts.push(text.slice(last));

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <Link
            key={i}
            href={`/tag/${encodeURIComponent(p.tag)}`}
            className="underline"
          >
            #{p.tag}
          </Link>
        )
      )}
    </span>
  );
}
