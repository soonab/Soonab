// src/lib/hashtags.ts

/**
 * Extract unique lowercase hashtags from a text blob.
 * Matches leading `#` followed by a–z, 0–9, or underscore characters.
 */
export function extractTags(text: string): string[] {
  const set = new Set<string>();
  const re = /#([a-z0-9_]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const tag = match[1]?.toLowerCase();
    if (tag) set.add(tag);
  }
  return Array.from(set);
}

